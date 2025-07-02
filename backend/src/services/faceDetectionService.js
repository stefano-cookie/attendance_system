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
        console.log(`\n🚀 ANALISI FACE DETECTION [${sessionId}]`);
        console.log(`Lesson ID: ${lessonId}`);
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
            
            if (analysisResult.recognized_students && analysisResult.recognized_students.length > 0) {
                const uniqueStudents = this._removeDuplicateStudents(analysisResult.recognized_students);
                console.log(`🔄 Eliminati duplicati: ${analysisResult.recognized_students.length} → ${uniqueStudents.length} studenti unici`);
                await this._saveAttendanceRecords(lessonId, uniqueStudents);
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

    async _saveAttendanceRecords(lessonId, recognizedStudents) {
        console.log(`\n💾 === SALVATAGGIO PRESENZE ===`);
        console.log(`📊 LessonId: ${lessonId} (type: ${typeof lessonId})`);
        console.log(`👥 Students count: ${recognizedStudents.length}`);
        console.log(`👥 Students data:`, JSON.stringify(recognizedStudents, null, 2));
        
        if (!recognizedStudents || recognizedStudents.length === 0) {
            console.log('⚠️ Nessuno studente da salvare');
            return;
        }
        
        try {
            const { Attendance } = require('../models');
            let savedCount = 0;
            let errorCount = 0;
            
            for (const [index, student] of recognizedStudents.entries()) {
                console.log(`\n🔄 Processing student ${index + 1}/${recognizedStudents.length}:`);
                console.log(`   - userId: ${student.userId} (type: ${typeof student.userId})`);
                console.log(`   - name: ${student.name} ${student.surname || ''}`);
                console.log(`   - confidence: ${student.confidence}`);
                
                try {
                    if (!student.userId || isNaN(student.userId)) {
                        throw new Error(`userId non valido: ${student.userId}`);
                    }
                    
                    let attendance = await Attendance.findOne({
                        where: { 
                            userId: parseInt(student.userId), 
                            lessonId: parseInt(lessonId)
                        }
                    });
                    
                    // Verifica soglia di confidenza rigorosa per evitare falsi positivi
                    const confidence = parseFloat(student.confidence);
                    if (confidence < 0.45) {
                        console.log(`   ⚠️ Confidenza troppo bassa per ${student.name}: ${confidence.toFixed(3)} < 0.45 - SCARTATO`);
                        continue;
                    }
                    
                    const attendanceData = {
                        is_present: true,
                        confidence: confidence,
                        detection_method: 'face_recognition',
                        timestamp: new Date(),
                        verified_by_teacher: false  // Richiede verifica manuale per alta confidenza
                    };
                    
                    if (attendance) {
                        console.log(`   ➡️ Aggiornamento presenza esistente ID: ${attendance.id}`);
                        await attendance.update(attendanceData);
                        console.log(`   ✅ Presenza aggiornata`);
                    } else {
                        console.log(`   ➡️ Creazione nuova presenza`);
                        const newAttendance = await Attendance.create({
                            userId: parseInt(student.userId),
                            lessonId: parseInt(lessonId),
                            ...attendanceData
                        });
                        console.log(`   ✅ Presenza creata con ID: ${newAttendance.id}`);
                    }
                    
                    savedCount++;
                    
                } catch (error) {
                    errorCount++;
                    console.error(`   ❌ Errore salvataggio per ${student.userId}:`, error.message);
                    console.error(`   ❌ Stack:`, error.stack);
                }
            }
            
            console.log(`\n📋 RIEPILOGO SALVATAGGIO:`);
            console.log(`   ✅ Salvati: ${savedCount}`);
            console.log(`   ❌ Errori: ${errorCount}`);
            console.log(`   📊 Totale processati: ${recognizedStudents.length}`);
            
        } catch (error) {
            console.error('❌ Errore generale salvataggio presenze:', error.message);
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