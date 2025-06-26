// backend/src/services/fileAnalysisService.js - VERSIONE COMPLETA CON SUPPORTO BLOB
const fs = require('fs');
const path = require('path');
const faceDetectionService = require('./faceDetectionService');
const imageStorageService = require('./imageStorageService');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

class FileAnalysisService {
    constructor() {
        console.log('===== INIZIALIZZAZIONE FILE ANALYSIS SERVICE IBRIDO =====');
        
        // Determinazione dei percorsi di base
        const serviceDir = __dirname;
        const srcDir = path.dirname(serviceDir);
        this.backendDir = path.dirname(srcDir);
        this.projectRoot = path.dirname(this.backendDir);
        
        console.log(`📁 Service dir: ${serviceDir}`);
        console.log(`📁 Src dir: ${srcDir}`);
        console.log(`📁 Backend dir: ${this.backendDir}`);
        console.log(`📁 Project root: ${this.projectRoot}`);
        
        // Usa la directory data a livello root, con fallback
        this.dataPath = path.join(this.projectRoot, 'data');
        
        if (!fs.existsSync(this.dataPath)) {
            console.log('⚠️ Directory data non trovata a livello root, uso quella in backend');
            this.dataPath = path.join(this.backendDir, 'data');
        }
        
        console.log(`📊 Directory data: ${this.dataPath}`);
        
        // Percorsi cruciali
        this.classroomImagesPath = path.join(this.dataPath, 'classroom_images');
        this.reportsPath = path.join(this.dataPath, 'reports');
        this.userPhotosPath = path.join(this.dataPath, 'user_photos');
        this.debugFacesPath = path.join(this.dataPath, 'debug_faces');
        this.tempPath = path.join(this.backendDir, 'temp');
        
        // Log percorsi
        console.log(`🖼️ Classroom images: ${this.classroomImagesPath}`);
        console.log(`📊 Reports: ${this.reportsPath}`);
        console.log(`👤 User photos: ${this.userPhotosPath}`);
        console.log(`🐛 Debug faces: ${this.debugFacesPath}`);
        console.log(`⏰ Temp: ${this.tempPath}`);
        
        // Modalità storage (hybrid di default)
        this.storageMode = process.env.IMAGE_STORAGE_MODE || 'hybrid';
        this.debugMode = process.env.DEBUG_MODE === 'true';
        this.bypassEnhancement = process.env.BYPASS_ENHANCEMENT === 'true';
        
        console.log(`🔧 Storage mode: ${this.storageMode}`);
        console.log(`🐛 Debug mode: ${this.debugMode}`);
        console.log(`⚡ Bypass enhancement: ${this.bypassEnhancement}`);
        
        // Crea le directory necessarie
        this.ensureDirectories();
        console.log('==================================================\n');
    }
    
    // Crea tutte le directory necessarie
    ensureDirectories() {
        console.log('📁 Creazione directory necessarie...');
        
        const dirs = [
            this.classroomImagesPath,
            this.reportsPath,
            this.userPhotosPath,
            this.debugFacesPath,
            this.tempPath
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                console.log(`  ➕ Creando: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            } else {
                console.log(`  ✅ Esistente: ${dir}`);
            }
        });
    }

    // Utility per sanitizzare i nomi file/cartelle
    sanitizeFileName(name) {
        if (!name) return '';
        return name.replace(/[^\w\s-]/gi, '')
                  .trim()
                  .replace(/\s+/g, '_');
    }
    
    // Crea la struttura delle cartelle per un corso
    ensureCourseDirectories(courseName) {
        const sanitizedCourseName = this.sanitizeFileName(courseName);
        
        const courseImagesPath = path.join(this.classroomImagesPath, sanitizedCourseName);
        const courseReportsPath = path.join(this.reportsPath, sanitizedCourseName);
        
        [courseImagesPath, courseReportsPath].forEach(dir => {
            if (!fs.existsSync(dir)) {
                console.log(`  ➕ Creando directory corso: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            }
        });
        
        return {
            imagesPath: courseImagesPath,
            reportsPath: courseReportsPath
        };
    }
    
    // Crea la struttura delle cartelle per una lezione
    ensureLessonDirectories(courseName, lessonName) {
        const sanitizedCourseName = this.sanitizeFileName(courseName);
        const sanitizedLessonName = this.sanitizeFileName(lessonName);
        
        const { imagesPath: courseImagesPath, reportsPath: courseReportsPath } = 
            this.ensureCourseDirectories(sanitizedCourseName);
        
        const lessonImagesPath = path.join(courseImagesPath, sanitizedLessonName);
        const lessonReportsPath = path.join(courseReportsPath, sanitizedLessonName);
        
        [lessonImagesPath, lessonReportsPath].forEach(dir => {
            if (!fs.existsSync(dir)) {
                console.log(`  ➕ Creando directory lezione: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            }
        });
        
        return {
            imagesPath: lessonImagesPath,
            reportsPath: lessonReportsPath
        };
    }

    // ✅ NUOVO: Trova immagini in modalità ibrida (Database + Filesystem)
    async findLessonImages(lessonId, imagesPath) {
        console.log(`🔍 Ricerca immagini per lezione ${lessonId} in modalità ${this.storageMode}`);
        const images = [];
        
        // 1. Cerca immagini nel database (BLOB) se modalità database o hybrid
        if (this.storageMode === 'database' || this.storageMode === 'hybrid') {
            try {
                console.log('  📊 Ricerca nel database...');
                const { LessonImage } = require('../models');
                const dbImages = await LessonImage.findAll({
                    where: { lesson_id: lessonId },
                    order: [['captured_at', 'DESC']]
                });
                
                console.log(`  ✅ Trovate ${dbImages.length} immagini nel database`);
                
                for (const dbImage of dbImages) {
                    // Crea file temporaneo per l'analisi
                    const tempFilename = `lesson_${lessonId}_${dbImage.id}_${Date.now()}.jpg`;
                    const tempPath = path.join(this.tempPath, tempFilename);
                    
                    // Scrivi l'immagine BLOB su file temporaneo
                    fs.writeFileSync(tempPath, dbImage.image_data);
                    
                    images.push({
                        path: tempPath,
                        source: 'database',
                        isTemporary: true,
                        dbImageId: dbImage.id,
                        filename: tempFilename,
                        originalSource: dbImage.source || 'unknown',
                        captured_at: dbImage.captured_at,
                        is_analyzed: dbImage.is_analyzed
                    });
                    
                    console.log(`    💾 ${tempFilename} (source: ${dbImage.source}, analyzed: ${dbImage.is_analyzed})`);
                }
            } catch (dbError) {
                console.warn(`  ⚠️ Errore ricerca database:`, dbError.message);
            }
        }
        
        // 2. Cerca immagini nel filesystem se modalità filesystem o hybrid
        if (this.storageMode === 'filesystem' || this.storageMode === 'hybrid') {
            console.log(`  📁 Ricerca nel filesystem: ${imagesPath}`);
            
            if (fs.existsSync(imagesPath)) {
                const files = fs.readdirSync(imagesPath);
                const imageFiles = files.filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
                });
                
                console.log(`  ✅ Trovate ${imageFiles.length} immagini nel filesystem`);
                
                for (const file of imageFiles) {
                    const filePath = path.join(imagesPath, file);
                    const stats = fs.statSync(filePath);
                    
                    images.push({
                        path: filePath,
                        source: 'filesystem',
                        isTemporary: false,
                        filename: file,
                        originalSource: 'filesystem',
                        captured_at: stats.mtime, // Usa data modifica file
                        size: stats.size
                    });
                    
                    console.log(`    📁 ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
                }
            } else {
                console.log(`  ⚠️ Directory non esistente: ${imagesPath}`);
            }
        }
        
        // Ordina per data di acquisizione (più recenti prima)
        images.sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at));
        
        console.log(`🖼️ Totale immagini trovate: ${images.length}`);
        console.log(`   📊 Database: ${images.filter(i => i.source === 'database').length}`);
        console.log(`   📁 Filesystem: ${images.filter(i => i.source === 'filesystem').length}`);
        
        return images;
    }

    // ✅ NUOVO: Pulisci file temporanei
    async cleanupTemporaryImages(images) {
        console.log('🧹 Pulizia file temporanei...');
        let cleaned = 0;
        
        for (const image of images) {
            if (image.isTemporary && fs.existsSync(image.path)) {
                try {
                    fs.unlinkSync(image.path);
                    console.log(`  🗑️ Rimosso: ${image.filename}`);
                    cleaned++;
                } catch (error) {
                    console.warn(`  ⚠️ Errore rimozione ${image.filename}: ${error.message}`);
                }
            }
        }
        
        console.log(`✅ File temporanei puliti: ${cleaned}`);
    }

    // Genera il JSON degli studenti con informazioni migliorate per DeepFace
    async generateStudentsJson(courseId) {
        try {
            console.log(`👥 Generazione JSON studenti per corso ${courseId || 'tutti'}...`);
            
            // Query per ottenere gli studenti del corso
            let studentsQuery = `
                SELECT id, name, surname, matricola, "photoPath", "faceEncodingId", email, "courseId"
                FROM "Users" 
                WHERE role = 'student'
            `;
            
            const replacements = {};
            
            if (courseId) {
                studentsQuery += ` AND "courseId" = :courseId`;
                replacements.courseId = courseId;
            }
            
            studentsQuery += ` ORDER BY surname, name`;
            
            console.log(`  📝 Esecuzione query studenti...`);
            
            // Esegui la query
            const students = await sequelize.query(studentsQuery, {
                replacements,
                type: QueryTypes.SELECT
            });
            
            console.log(`  ✅ Trovati ${students.length} studenti totali`);
            
            // Anche se non ci sono studenti, creiamo comunque un file JSON vuoto
            if (students.length === 0) {
                console.warn(`  ⚠️ Nessuno studente trovato!`);
                
                const studentsJsonPath = path.join(this.dataPath, `students_data${courseId ? '_course'+courseId : ''}.json`);
                fs.writeFileSync(studentsJsonPath, JSON.stringify([], null, 2));
                console.log(`  📄 File JSON studenti vuoto: ${studentsJsonPath}`);
                
                return { studentsData: [], studentsJsonPath };
            }
            
            // Verifica directory foto utenti
            console.log(`  📁 Directory foto utenti: ${this.userPhotosPath}`);
            if (!fs.existsSync(this.userPhotosPath)) {
                console.warn(`  ⚠️ Directory foto utenti non trovata, la creo...`);
                fs.mkdirSync(this.userPhotosPath, { recursive: true });
            }
            
            // Processa le foto degli studenti
            const studentsData = [];
            let studentsWithValidPhotos = 0;
            
            for (const student of students) {
                const studentName = `${student.name} ${student.surname}`;
                console.log(`  👤 Elaborazione: ${studentName} (ID: ${student.id})`);
                
                if (!student.photoPath) {
                    console.log(`    ⚠️ Nessun percorso foto impostato`);
                    continue;
                }
                
                console.log(`    📸 Percorso originale: ${student.photoPath}`);
                let photoPath = student.photoPath;
                
                // Se non è un percorso assoluto, cerca in diverse posizioni
                if (!path.isAbsolute(photoPath)) {
                    const possiblePaths = [
                        path.join(this.userPhotosPath, path.basename(photoPath)),
                        path.join(this.projectRoot, photoPath),
                        photoPath,
                        // Prova con l'ID dello studente
                        path.join(this.userPhotosPath, `${student.id}.jpg`),
                        path.join(this.userPhotosPath, `${student.id}.png`),
                        path.join(this.userPhotosPath, `${student.id}.jpeg`),
                        // Prova con la matricola
                        ...(student.matricola ? [
                            path.join(this.userPhotosPath, `${student.matricola}.jpg`),
                            path.join(this.userPhotosPath, `${student.matricola}.png`),
                            path.join(this.userPhotosPath, `${student.matricola}.jpeg`)
                        ] : [])
                    ];
                    
                    console.log(`    🔍 Test percorsi possibili...`);
                    
                    let found = false;
                    for (const testPath of possiblePaths) {
                        if (fs.existsSync(testPath)) {
                            const stats = fs.statSync(testPath);
                            if (stats.size > 0) {
                                photoPath = testPath;
                                console.log(`    ✅ Foto trovata: ${testPath} (${(stats.size/1024).toFixed(1)}KB)`);
                                found = true;
                                break;
                            }
                        }
                    }
                    
                    if (!found) {
                        console.log(`    ❌ Foto non trovata in nessun percorso`);
                        continue;
                    }
                } else if (!fs.existsSync(photoPath)) {
                    console.log(`    ❌ Foto non trovata nel percorso assoluto: ${photoPath}`);
                    continue;
                }
                
                // Verifica che l'immagine sia valida
                try {
                    const photoStats = fs.statSync(photoPath);
                    
                    if (photoStats.size > 0) {
                        // Aggiungi al JSON con informazioni migliorate
                        studentsData.push({
                            ...student,
                            photoPath,
                            fullName: `${student.name} ${student.surname}`.trim(),
                            // Metadati utili per DeepFace
                            photoSize: photoStats.size,
                            photoModified: photoStats.mtime.toISOString()
                        });
                        studentsWithValidPhotos++;
                        console.log(`    ✅ Studente aggiunto al JSON`);
                    } else {
                        console.log(`    ❌ Foto vuota (0 bytes)`);
                    }
                } catch (error) {
                    console.log(`    ❌ Errore verifica foto: ${error.message}`);
                }
            }
            
            console.log(`📊 Riepilogo studenti:`);
            console.log(`   Totale: ${students.length}`);
            console.log(`   Con foto valide: ${studentsWithValidPhotos}`);
            console.log(`   Percentuale: ${students.length > 0 ? (studentsWithValidPhotos/students.length*100).toFixed(1) : 0}%`);
            
            // Salva JSON studenti
            const studentsJsonPath = path.join(this.dataPath, `students_data${courseId ? '_course'+courseId : ''}.json`);
            fs.writeFileSync(studentsJsonPath, JSON.stringify(studentsData, null, 2));
            console.log(`📄 File JSON studenti salvato: ${studentsJsonPath}`);
            
            return { studentsData, studentsJsonPath };
        } catch (error) {
            console.error('❌ Errore generazione file studenti:', error);
            
            // Creiamo comunque un file JSON di fallback vuoto
            const studentsJsonPath = path.join(this.dataPath, `students_data_fallback${courseId ? '_course'+courseId : ''}.json`);
            fs.writeFileSync(studentsJsonPath, JSON.stringify([], null, 2));
            console.log(`📄 File JSON fallback creato: ${studentsJsonPath}`);
            
            return { studentsData: [], studentsJsonPath };
        }
    }
    
    // ✅ METODO PRINCIPALE: Analisi lezione con supporto ibrido completo
    async analyzeLessonImages(lessonId, courseName, lessonName, specificImagePath = null) {
        console.log(`\n🚀 AVVIO ANALISI IBRIDA`);
        console.log(`======================================`);
        console.log(`📚 Lezione ID: ${lessonId}`);
        console.log(`🎓 Corso: ${courseName}`);
        console.log(`📖 Lezione: ${lessonName}`);
        console.log(`🔧 Storage mode: ${this.storageMode}`);
        console.log(`🖼️ Immagine specifica: ${specificImagePath || 'No'}`);
        console.log(`======================================\n`);
        
        try {
            // 1. Ottieni informazioni dettagliate sulla lezione
            console.log('1️⃣ Recupero informazioni lezione...');
            const [lesson] = await sequelize.query(`
                SELECT l.id, l.name as lesson_name, l.course_id, c.name as course_name,
                       s.id as subject_id, s.name as subject_name,
                       cl.id as classroom_id, cl.name as classroom_name
                FROM "Lessons" l
                LEFT JOIN "Courses" c ON l.course_id = c.id
                LEFT JOIN "Subjects" s ON l.subject_id = s.id
                LEFT JOIN "Classrooms" cl ON l.classroom_id = cl.id
                WHERE l.id = :lessonId
            `, {
                replacements: { lessonId },
                type: QueryTypes.SELECT
            });
            
            if (!lesson) {
                throw new Error(`Lezione con ID ${lessonId} non trovata nel database`);
            }
            
            // Usa nomi dal database se disponibili
            const actualCourseName = lesson.course_name || courseName || `Corso_${lesson.course_id}`;
            const actualLessonName = lesson.lesson_name || lessonName || `Lezione_${lessonId}`;
            const subjectName = lesson.subject_name || '';
            const classroomName = lesson.classroom_name || '';
            
            console.log(`✅ Lezione trovata:`);
            console.log(`   📚 Corso: "${actualCourseName}"`);
            console.log(`   📖 Lezione: "${actualLessonName}"`);
            console.log(`   📝 Materia: "${subjectName}"`);
            console.log(`   🏫 Aula: "${classroomName}"`);
            
            // 2. Assicura l'esistenza delle directory per filesystem
            console.log('\n2️⃣ Preparazione directory filesystem...');
            const { imagesPath, reportsPath } = this.ensureLessonDirectories(
                actualCourseName, 
                actualLessonName
            );
            
            console.log(`📁 Directory immagini: ${imagesPath}`);
            console.log(`📊 Directory reports: ${reportsPath}`);
            
            // 3. Trova immagini da analizzare
            console.log('\n3️⃣ Ricerca immagini da analizzare...');
            let imagesToAnalyze = [];
            
            if (specificImagePath && fs.existsSync(specificImagePath)) {
                console.log(`🎯 Usando immagine specifica: ${specificImagePath}`);
                imagesToAnalyze = [{
                    path: specificImagePath,
                    source: 'specific',
                    isTemporary: specificImagePath.includes(this.tempPath),
                    filename: path.basename(specificImagePath),
                    originalSource: 'provided',
                    captured_at: new Date()
                }];
            } else {
                // Trova immagini in modalità ibrida
                imagesToAnalyze = await this.findLessonImages(lessonId, imagesPath);
            }
            
            if (imagesToAnalyze.length === 0) {
                const errorMsg = this.storageMode === 'database' 
                    ? `Nessuna immagine trovata nel database per la lezione ${lessonId}. Carica immagini usando upload o camera.`
                    : this.storageMode === 'filesystem' 
                    ? `Nessuna immagine trovata nella directory: ${imagesPath}. Aggiungi file immagine.`
                    : `Nessuna immagine trovata né nel database né in: ${imagesPath}. Carica immagini usando upload/camera o aggiungi file.`;
                
                throw new Error(errorMsg);
            }
            
            console.log(`✅ Immagini da analizzare: ${imagesToAnalyze.length}`);
            
            // 4. Genera JSON degli studenti
            console.log('\n4️⃣ Generazione dati studenti...');
            let { studentsJsonPath, studentsData } = await this.generateStudentsJson(lesson.course_id);
            
            let skipStudentRecognition = false;
            if (!studentsJsonPath || (studentsData && studentsData.length === 0)) {
                console.warn(`⚠️ Nessuno studente con foto disponibile per corso ${lesson.course_id}`);
                console.warn(`   L'analisi procederà comunque per rilevare i volti`);
                skipStudentRecognition = true;
                
                if (!studentsJsonPath) {
                    studentsJsonPath = path.join(this.dataPath, `students_data_empty_${lesson.course_id}.json`);
                    fs.writeFileSync(studentsJsonPath, JSON.stringify([], null, 2));
                }
            } else {
                console.log(`✅ Studenti disponibili: ${studentsData.length}`);
            }
            
            // 5. Elabora ogni immagine
            console.log('\n5️⃣ Avvio elaborazione immagini...');
            const analysisResults = [];
            let totalFaces = 0;
            let totalRecognized = 0;
            
            for (let i = 0; i < imagesToAnalyze.length; i++) {
                const imageInfo = imagesToAnalyze[i];
                const imageNum = i + 1;
                
                console.log(`\n📸 Immagine ${imageNum}/${imagesToAnalyze.length}: ${imageInfo.filename}`);
                console.log(`   📍 Source: ${imageInfo.source} (${imageInfo.originalSource})`);
                console.log(`   📁 Path: ${imageInfo.path}`);
                
                // Nome file report
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const reportFilename = `report_${path.basename(imageInfo.filename, path.extname(imageInfo.filename))}_${timestamp}.json`;
                const reportPath = path.join(reportsPath, reportFilename);
                
                console.log(`   📊 Report: ${reportFilename}`);
                
                // Opzioni per il processing
                const processingOptions = {
                    outputPath: reportPath,
                    bypassEnhancement: this.bypassEnhancement,
                    debugMode: this.debugMode,
                    courseId: lesson.course_id,
                    studentsJsonPath,
                    skipStudentRecognition,
                    sourceType: imageInfo.source,
                    dbImageId: imageInfo.dbImageId,
                    lessonInfo: {
                        courseName: actualCourseName,
                        lessonName: actualLessonName,
                        classroomName
                    }
                };
                
                try {
                    console.time(`   ⏱️ Tempo elaborazione`);
                    const result = await faceDetectionService.processImage(
                        imageInfo.path, 
                        lessonId,
                        processingOptions
                    );
                    console.timeEnd(`   ⏱️ Tempo elaborazione`);
                    
                    const faces = result.detected_faces || 0;
                    const recognized = result.recognized_students ? result.recognized_students.length : 0;
                    
                    totalFaces += faces;
                    totalRecognized += recognized;
                    
                    analysisResults.push({
                        imageFile: imageInfo.filename,
                        reportFile: reportFilename,
                        reportPath,
                        detectedFaces: faces,
                        recognizedStudents: recognized,
                        screenshotId: result.screenshotId,
                        source: imageInfo.source,
                        dbImageId: imageInfo.dbImageId,
                        success: result.success,
                        processingTime: result.processingTime || 'N/A'
                    });
                    
                    console.log(`   ✅ Risultato: ${faces} volti, ${recognized} riconosciuti`);
                    
                    // Marca come analizzata se da database
                    if (imageInfo.source === 'database' && imageInfo.dbImageId) {
                        try {
                            const { LessonImage } = require('../models');
                            await LessonImage.update(
                                { 
                                    is_analyzed: true,
                                    analysis_metadata: {
                                        analyzed_at: new Date().toISOString(),
                                        detected_faces: faces,
                                        recognized_students: recognized,
                                        analysis_version: 'hybrid_v1'
                                    }
                                },
                                { where: { id: imageInfo.dbImageId } }
                            );
                            console.log(`   💾 Immagine DB ${imageInfo.dbImageId} aggiornata`);
                        } catch (updateError) {
                            console.warn(`   ⚠️ Errore aggiornamento DB: ${updateError.message}`);
                        }
                    }
                    
                } catch (imageError) {
                    console.error(`   ❌ Errore elaborazione: ${imageError.message}`);
                    analysisResults.push({
                        imageFile: imageInfo.filename,
                        reportFile: reportFilename,
                        reportPath,
                        error: imageError.message,
                        detectedFaces: 0,
                        recognizedStudents: 0,
                        source: imageInfo.source,
                        success: false
                    });
                }
            }
            
            // 6. Pulisci file temporanei
            console.log('\n6️⃣ Pulizia file temporanei...');
            await this.cleanupTemporaryImages(imagesToAnalyze);
            
            // 7. Statistiche finali
            console.log('\n7️⃣ Statistiche finali:');
            const successfulAnalysis = analysisResults.filter(r => r.success !== false).length;
            const failedAnalysis = analysisResults.filter(r => r.success === false).length;
            
            console.log(`   ✅ Analisi riuscite: ${successfulAnalysis}/${analysisResults.length}`);
            console.log(`   ❌ Analisi fallite: ${failedAnalysis}/${analysisResults.length}`);
            console.log(`   👥 Totale volti rilevati: ${totalFaces}`);
            console.log(`   🎯 Totale studenti riconosciuti: ${totalRecognized}`);
            
            const finalResult = {
                success: true,
                lessonId,
                courseName: actualCourseName,
                lessonName: actualLessonName,
                subjectName,
                classroomName,
                imagesPath,
                reportsPath,
                imagesCount: imagesToAnalyze.length,
                results: analysisResults,
                statistics: {
                    totalImages: analysisResults.length,
                    successfulAnalysis,
                    failedAnalysis,
                    totalFaces,
                    totalRecognized,
                    averageFacesPerImage: analysisResults.length > 0 ? (totalFaces / analysisResults.length).toFixed(1) : 0
                },
                storageMode: this.storageMode,
                sources: {
                    database: analysisResults.filter(r => r.source === 'database').length,
                    filesystem: analysisResults.filter(r => r.source === 'filesystem').length,
                    specific: analysisResults.filter(r => r.source === 'specific').length
                },
                skipStudentRecognition,
                warnings: skipStudentRecognition ? ["Riconoscimento studenti saltato: nessuno studente con foto disponibile"] : [],
                timestamp: new Date().toISOString()
            };
            
            console.log('\n🎉 ANALISI COMPLETATA CON SUCCESSO!');
            console.log('=====================================\n');
            
            return finalResult;
            
        } catch (error) {
            console.error('\n❌ ERRORE DURANTE ANALISI:', error);
            console.error('================================\n');
            
            return {
                success: false,
                lessonId,
                courseName, 
                lessonName,
                storageMode: this.storageMode,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    // Verifica lo stato del sistema di riconoscimento
    async checkRecognitionSystem() {
        try {
            console.log('🔍 Verifica sistema di riconoscimento...');
            
            // Verifica faceDetectionService
            const faceDetectionStatus = await faceDetectionService.checkStatus();
            
            // Verifica le directory necessarie
            const dirStatus = {
                dataDir: fs.existsSync(this.dataPath),
                classroomImagesDir: fs.existsSync(this.classroomImagesPath),
                userPhotosDir: fs.existsSync(this.userPhotosPath),
                reportsDir: fs.existsSync(this.reportsPath),
                tempDir: fs.existsSync(this.tempPath)
            };
            
            // Conta file studenti
            const studentFiles = fs.readdirSync(this.dataPath)
                .filter(file => file.startsWith('students_data') && file.endsWith('.json'));
            
            // Conta immagini nel database se possibile
            let dbImageStats = null;
            try {
                const { LessonImage } = require('../models');
                const stats = await LessonImage.findAll({
                    attributes: [
                        'source',
                        [require('sequelize').fn('COUNT', '*'), 'count'],
                        [require('sequelize').fn('COUNT', require('sequelize').where(require('sequelize').col('is_analyzed'), true)), 'analyzed']
                    ],
                    group: ['source'],
                    raw: true
                });
                dbImageStats = stats;
            } catch (dbError) {
                console.warn('⚠️ Impossibile verificare statistiche database:', dbError.message);
            }
            
            const isReady = faceDetectionStatus.status === 'Pronto' && 
                           dirStatus.dataDir && 
                           dirStatus.userPhotosDir &&
                           dirStatus.tempDir;
            
            return {
                ...faceDetectionStatus,
                fileAnalysisService: {
                    storageMode: this.storageMode,
                    debugMode: this.debugMode,
                    bypassEnhancement: this.bypassEnhancement
                },
                dirStatus,
                studentFiles,
                studentFilesCount: studentFiles.length,
                dbImageStats,
                ready: isReady,
                systemVersion: 'HYBRID_COMPLETE'
            };
        } catch (error) {
            console.error('❌ Errore verifica sistema:', error);
            return {
                status: 'Errore',
                error: error.message,
                systemVersion: 'HYBRID_COMPLETE'
            };
        }
    }
}

module.exports = new FileAnalysisService();