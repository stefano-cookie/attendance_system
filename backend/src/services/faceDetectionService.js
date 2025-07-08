const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

class FaceDetectionService {
    constructor() {
        console.log('\n=== FACE DETECTION SERVICE v2.0 ===');
        console.log('===================================\n');
        
        this.backendDir = process.cwd();
        
        this.tempDir = path.join(this.backendDir, 'temp', 'face_processing');
        this.tempImagesDir = path.join(this.tempDir, 'images');
        this.tempStudentsDir = path.join(this.tempDir, 'students');
        this.tempOutputDir = path.join(this.tempDir, 'output');
        
        [this.tempDir, this.tempImagesDir, this.tempStudentsDir, this.tempOutputDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
        
        this.pythonScriptPath = path.join(this.backendDir, 'scripts', 'face_detection.py');
        this.configPath = path.join(this.backendDir, 'config', 'face_detection_config.json');
        
        console.log('✅ Face Detection v2.0 (RetinaFace + Facenet512)');
        
        this.pythonExecutable = this._findPythonExecutable();
        
        console.log(`📁 Backend dir: ${this.backendDir}`);
        console.log(`📁 Temp dir: ${this.tempDir}`);
        console.log(`🐍 Python script: ${this.pythonScriptPath}`);
        console.log(`🐍 Python executable: ${this.pythonExecutable}`);
        console.log('\n✅ Face Detection Service inizializzato\n');
    }

    _findPythonExecutable() {
        const possiblePaths = [
            '/Users/stebbi/attendance-system/venv_deepface/bin/python3',
            path.join(this.backendDir, '../venv_deepface/bin/python3'),
            path.join(this.backendDir, '../../venv_deepface/bin/python3'),
            'python3'
        ];
        
        for (const pythonPath of possiblePaths) {
            try {
                if (pythonPath === 'python3' || fs.existsSync(pythonPath)) {
                    return pythonPath;
                }
            } catch (e) {
                continue;
            }
        }
        
        return 'python3';
    }

    async analyzeImageBlob(imageBlob, lessonId, options = {}) {
        const sessionId = crypto.randomBytes(8).toString('hex');
        const imageId = options.imageId || null;
        console.log(`\n🚀 ANALISI FACE DETECTION [${sessionId}]`);
        console.log(`Lesson ID: ${lessonId}`);
        console.log(`Image ID: ${imageId}`);
        console.log(`Blob size: ${imageBlob.length} bytes`);
        
        let tempImagePath = null;
        let tempStudentsJsonPath = null;
        let tempOutputPath = null;
        let tempStudentsDir = null;
        let analysisResult = null;
        
        try {
            if (!imageBlob || imageBlob.length === 0) {
                throw new Error('BLOB immagine vuoto');
            }
            
            tempImagePath = await this._saveBlobAsFile(imageBlob, sessionId);
            console.log(`✅ Immagine salvata: ${tempImagePath}`);
            
            console.log(`🔍 DEBUG: Cercando info per lessonId=${lessonId}`);
            const lessonInfo = await this._getLessonInfo(lessonId);
            console.log(`🔍 DEBUG: lessonInfo result:`, lessonInfo);
            if (!lessonInfo) {
                throw new Error(`Lezione ${lessonId} non trovata`);
            }
            console.log(`📚 Corso: ${lessonInfo.course_name} (ID: ${lessonInfo.course_id})`);
            
            const studentsData = await this._generateStudentsData(lessonInfo.course_id, sessionId);
            tempStudentsJsonPath = studentsData.jsonPath;
            tempStudentsDir = studentsData.photosDir;
            console.log(`✅ Studenti generati: ${studentsData.count}`);
            
            tempOutputPath = path.join(this.tempOutputDir, `result_${sessionId}.json`);
            
            analysisResult = await this._executePythonAnalysis({
                imagePath: tempImagePath,
                studentsPath: tempStudentsJsonPath,
                outputPath: tempOutputPath,
                sessionId
            });
            
            console.log(`✅ Analisi completata: ${analysisResult.detected_faces} volti, ${analysisResult.recognized_students?.length || 0} riconosciuti`);
            
            // Salva sempre un report completo per tutti gli studenti del corso
            await this._saveCompleteAttendanceReport(lessonId, analysisResult.recognized_students || [], imageId);
            
            if (analysisResult.recognized_students && analysisResult.recognized_students.length > 0) {
                const uniqueStudents = this._removeDuplicateStudents(analysisResult.recognized_students);
                console.log(`🔄 Eliminati duplicati: ${analysisResult.recognized_students.length} → ${uniqueStudents.length} studenti unici`);
                analysisResult.recognized_students = uniqueStudents;
            }
            
            let reportImageBlob = null;
            console.log(`\n🖼️ === CONVERSIONE IMMAGINE REPORT ===`);
            console.log(`📂 Report image path: ${analysisResult.report_image}`);
            console.log(`📁 Path exists: ${analysisResult.report_image ? fs.existsSync(analysisResult.report_image) : 'false'}`);
            
            if (analysisResult.report_image && fs.existsSync(analysisResult.report_image)) {
                try {
                    reportImageBlob = fs.readFileSync(analysisResult.report_image);
                    console.log(`✅ Report immagine convertita: ${reportImageBlob.length} bytes`);
                    console.log(`📊 File stats:`, fs.statSync(analysisResult.report_image));
                    
                    // Cancella il file temporaneo dopo la lettura
                    try {
                        fs.unlinkSync(analysisResult.report_image);
                        console.log(`🧹 File report temporaneo cancellato: ${analysisResult.report_image}`);
                    } catch (cleanupError) {
                        console.warn(`⚠️ Errore cancellazione file report: ${cleanupError.message}`);
                    }
                } catch (error) {
                    console.warn(`⚠️ Errore lettura report immagine: ${error.message}`);
                }
            } else {
                console.warn(`⚠️ Report immagine non trovata o path non valido`);
                if (analysisResult.report_image) {
                    console.warn(`   Path: ${analysisResult.report_image}`);
                }
            }
            
            return {
                success: true,
                sessionId,
                reportImagePath: analysisResult.report_image,
                reportImageBlob: reportImageBlob,
                ...analysisResult
            };
            
        } catch (error) {
            console.error(`❌ Errore analisi [${sessionId}]:`, error.message);
            
            return {
                success: false,
                sessionId,
                error: error.message,
                detected_faces: 0,
                recognized_students: []
            };
            
        } finally {
            const filesToCleanup = [
                tempImagePath,
                tempStudentsJsonPath,
                tempOutputPath,
                tempStudentsDir
            ];
            
            console.log(`🧹 File da pulire: ${filesToCleanup.filter(f => f).length}`);
            if (analysisResult && analysisResult.report_image) {
                console.log(`🖼️ Report image NON cancellata: ${analysisResult.report_image}`);
            }
            
            this._cleanupTempFiles(filesToCleanup, sessionId);
        }
    }

    async _saveBlobAsFile(imageBlob, sessionId) {
        try {
            let buffer;
            
            if (Buffer.isBuffer(imageBlob)) {
                buffer = imageBlob;
            } else if (typeof imageBlob === 'string') {
                buffer = Buffer.from(imageBlob, 'base64');
            } else {
                buffer = Buffer.from(imageBlob);
            }
            
            const filePath = path.join(this.tempImagesDir, `image_${sessionId}.jpg`);
            fs.writeFileSync(filePath, buffer);
            
            return filePath;
            
        } catch (error) {
            throw new Error(`Errore salvataggio immagine: ${error.message}`);
        }
    }

    async _getLessonInfo(lessonId) {
        try {
            const [lesson] = await sequelize.query(`
                SELECT l.id, l.course_id, c.name as course_name
                FROM "Lessons" l
                LEFT JOIN "Courses" c ON l.course_id = c.id
                WHERE l.id = :lessonId
            `, {
                replacements: { lessonId },
                type: QueryTypes.SELECT
            });
            
            return lesson;
        } catch (error) {
            console.error('Errore query lesson:', error);
            return null;
        }
    }

    async _generateStudentsData(courseId, sessionId) {
        try {
            const students = await sequelize.query(`
                SELECT id, name, surname, matricola, "photoPath", email
                FROM "Users" 
                WHERE role = 'student' 
                AND "courseId" = :courseId
                AND "photoPath" IS NOT NULL
            `, {
                replacements: { courseId },
                type: QueryTypes.SELECT
            });
            
            console.log(`👥 Trovati ${students.length} studenti per corso ${courseId}`);
            
            // Crea directory per foto temporanee
            const photosDir = path.join(this.tempStudentsDir, `session_${sessionId}`);
            fs.mkdirSync(photosDir, { recursive: true });
            
            const validStudents = [];
            
            for (const student of students) {
                try {
                    let photoBuffer;
                    
                    if (Buffer.isBuffer(student.photoPath)) {
                        photoBuffer = student.photoPath;
                    } else if (typeof student.photoPath === 'string' && student.photoPath.length > 1000) {
                        photoBuffer = Buffer.from(student.photoPath, 'base64');
                    } else {
                        console.warn(`⚠️ Foto non valida per ${student.name} ${student.surname}`);
                        continue;
                    }
                    
                    const photoPath = path.join(photosDir, `student_${student.id}.jpg`);
                    fs.writeFileSync(photoPath, photoBuffer);
                    
                    validStudents.push({
                        id: student.id,
                        name: student.name,
                        surname: student.surname,
                        matricola: student.matricola,
                        email: student.email,
                        photoPath: photoPath
                    });
                    
                } catch (error) {
                    console.warn(`⚠️ Errore processamento foto per ${student.name}: ${error.message}`);
                }
            }
            
                const jsonPath = path.join(this.tempStudentsDir, `students_${sessionId}.json`);
            fs.writeFileSync(jsonPath, JSON.stringify(validStudents, null, 2));
            
            return {
                students: validStudents,
                count: validStudents.length,
                jsonPath: jsonPath,
                photosDir: photosDir
            };
            
        } catch (error) {
            console.error('Errore generazione studenti:', error);
            throw error;
        }
    }

    async _executePythonAnalysis({ imagePath, studentsPath, outputPath, sessionId }) {
        console.log(`\n🐍 Esecuzione analisi Python [${sessionId}]...`);
        
        return new Promise((resolve, reject) => {
            const args = [
                this.pythonScriptPath,
                imagePath,
                '--output', outputPath,
                '--students', studentsPath
            ];
            
            // Aggiungi config path
            if (fs.existsSync(this.configPath)) {
                args.push('--config', this.configPath);
            }
            
            console.log(`Comando: ${this.pythonExecutable} ${args.join(' ')}`);
            
            const pythonProcess = spawn(this.pythonExecutable, args, {
                env: { ...process.env, PYTHONUNBUFFERED: '1' }
            });
            
            let stdout = '';
            let stderr = '';
            
            const timeout = setTimeout(() => {
                console.error('⏱️ Timeout Python - killing process');
                pythonProcess.kill('SIGKILL');
                reject(new Error('Timeout analisi Python'));
            }, 60000);
            
            pythonProcess.stdout.on('data', (data) => {
                const text = data.toString();
                stdout += text;
                console.log(`[Python OUT] ${text.trim()}`);
            });
            
            pythonProcess.stderr.on('data', (data) => {
                const text = data.toString();
                stderr += text;
                if (!text.includes('tensorflow') && !text.includes('WARNING')) {
                    console.log(`[Python ERR] ${text.trim()}`);
                }
            });
            
            pythonProcess.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
            
            pythonProcess.on('close', (code) => {
                clearTimeout(timeout);
                
                console.log(`\n✅ Python completato con exit code: ${code}`);
                
                if (code !== 0) {
                    reject(new Error(`Python script fallito con codice ${code}`));
                    return;
                }
                
                try {
                    if (fs.existsSync(outputPath)) {
                        const resultData = fs.readFileSync(outputPath, 'utf8');
                        const result = JSON.parse(resultData);
                        resolve(result);
                    } else {
                        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            resolve(JSON.parse(jsonMatch[0]));
                        } else {
                            resolve({
                                detected_faces: 0,
                                recognized_students: [],
                                error: 'Nessun output generato'
                            });
                        }
                    }
                } catch (error) {
                    console.error('Errore parsing risultato:', error);
                    resolve({
                        detected_faces: 0,
                        recognized_students: [],
                        error: 'Errore parsing risultato'
                    });
                }
            });
        });
    }


    async _saveCompleteAttendanceReport(lessonId, recognizedStudents, imageId = null) {
        console.log(`\n📊 === SALVATAGGIO REPORT COMPLETO ===`);
        console.log(`📊 LessonId: ${lessonId}`);
        console.log(`📸 ImageId: ${imageId}`);
        console.log(`👥 Recognized students count: ${recognizedStudents.length}`);
        
        try {
            const { Attendance } = require('../models');
            
            const lessonInfo = await this._getLessonInfo(lessonId);
            if (!lessonInfo) {
                throw new Error(`Lezione ${lessonId} non trovata`);
            }
            
            const allStudents = await sequelize.query(`
                SELECT u.id, u.name, u.surname, u.email, u.matricola
                FROM "Users" u 
                WHERE u."courseId" = :courseId AND u.role = 'student' AND u.is_active = true
                ORDER BY u.surname, u.name
            `, {
                replacements: { courseId: lessonInfo.course_id },
                type: sequelize.QueryTypes.SELECT
            });
            
            console.log(`👥 Studenti totali iscritti al corso: ${allStudents.length}`);
            
            const recognizedMap = new Map();
            (recognizedStudents || []).forEach(student => {
                if (student.userId && !isNaN(student.userId)) {
                    recognizedMap.set(parseInt(student.userId), student);
                }
            });
            
            console.log(`✅ Studenti riconosciuti: ${recognizedMap.size}`);
            
            let presentCount = 0;
            let absentCount = 0;
            let createdCount = 0;
            
            for (const student of allStudents) {
                try {
                    const studentId = student.id;
                    const isRecognized = recognizedMap.has(studentId);
                    const recognizedData = recognizedMap.get(studentId);
                    
                    const attendanceData = {
                        userId: studentId,
                        lessonId: parseInt(lessonId),
                        is_present: isRecognized,
                        confidence: isRecognized ? (recognizedData.confidence || 0.8) : 0.0,
                        detection_method: 'face_recognition',
                        timestamp: new Date(),
                        verified_by_teacher: false,
                        imageId: imageId
                    };
                    
                    const newAttendance = await Attendance.create(attendanceData);
                    createdCount++;
                    console.log(`   ✅ Creato nuovo record (ID: ${newAttendance.id}): ${student.name} ${student.surname} - ${isRecognized ? 'PRESENTE' : 'ASSENTE'} (ImageId: ${imageId})`);
                    
                    
                    if (isRecognized) {
                        presentCount++;
                    } else {
                        absentCount++;
                    }
                    
                } catch (error) {
                    console.error(`   ❌ Errore per studente ${student.id} (${student.name}):`, error.message);
                }
            }
            
            console.log(`\n📋 RIEPILOGO REPORT COMPLETO:`);
            console.log(`   👥 Studenti totali: ${allStudents.length}`);
            console.log(`   ✅ Presenti: ${presentCount}`);
            console.log(`   ❌ Assenti: ${absentCount}`);
            console.log(`   ➕ Nuovi record creati: ${createdCount}`);
            console.log(`   🎯 Percentuale presenza: ${allStudents.length > 0 ? ((presentCount / allStudents.length) * 100).toFixed(1) : 0}%`);
            console.log(`   📸 ImageId associato: ${imageId || 'N/A'}`);
            
        } catch (error) {
            console.error('❌ Errore generale salvataggio report completo:', error.message);
            console.error('❌ Stack:', error.stack);
        }
    }

    _removeDuplicateStudents(recognizedStudents) {
        const studentMap = new Map();
        
        recognizedStudents.forEach(student => {
            const key = student.userId;
            if (!studentMap.has(key) || studentMap.get(key).confidence < student.confidence) {
                studentMap.set(key, student);
            }
        });
        
        return Array.from(studentMap.values());
    }

    _cleanupTempFiles(filePaths, sessionId) {
        console.log(`\n🧹 Cleanup file temporanei [${sessionId}]...`);
        
        for (const filePath of filePaths) {
            if (filePath && fs.existsSync(filePath)) {
                try {
                    const stats = fs.statSync(filePath);
                    if (stats.isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                    console.log(`   ✅ Rimosso: ${path.basename(filePath)}`);
                } catch (error) {
                    console.warn(`   ⚠️ Errore rimozione ${filePath}: ${error.message}`);
                }
            }
        }
    }

    async checkStatus() {
        const scriptExists = fs.existsSync(this.pythonScriptPath);
        const tempDirExists = fs.existsSync(this.tempDir);
        
        return {
            ready: scriptExists,
            pythonExecutable: this.pythonExecutable,
            pythonScriptExists: scriptExists,
            tempDirectory: this.tempDir,
            tempDirExists: tempDirExists,
            status: scriptExists ? 'Ready' : 'Script mancante'
        };
    }
}

// Esporta singola istanza
module.exports = new FaceDetectionService();