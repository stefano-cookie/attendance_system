// backend/src/services/faceDetectionService.js
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
        
        // Percorsi base
        this.backendDir = process.cwd();
        
        // Directory temporanea
        this.tempDir = path.join(this.backendDir, 'temp', 'face_processing');
        this.tempImagesDir = path.join(this.tempDir, 'images');
        this.tempStudentsDir = path.join(this.tempDir, 'students');
        this.tempOutputDir = path.join(this.tempDir, 'output');
        
        // Crea directory necessarie
        [this.tempDir, this.tempImagesDir, this.tempStudentsDir, this.tempOutputDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
        
        // Script Python
        this.pythonScriptPath = path.join(this.backendDir, 'scripts', 'face_detection.py');
        
        // Python executable
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
        
        try {
            // 1. Validazione BLOB
            if (!imageBlob || imageBlob.length === 0) {
                throw new Error('BLOB immagine vuoto');
            }
            
            // 2. Salva BLOB come file temporaneo
            tempImagePath = await this._saveBlobAsFile(imageBlob, sessionId);
            console.log(`✅ Immagine salvata: ${tempImagePath}`);
            
            // 3. Ottieni info lezione
            const lessonInfo = await this._getLessonInfo(lessonId);
            if (!lessonInfo) {
                throw new Error(`Lezione ${lessonId} non trovata`);
            }
            console.log(`📚 Corso: ${lessonInfo.course_name} (ID: ${lessonInfo.course_id})`);
            
            // 4. Genera file studenti
            const studentsData = await this._generateStudentsData(lessonInfo.course_id, sessionId);
            tempStudentsJsonPath = studentsData.jsonPath;
            tempStudentsDir = studentsData.photosDir;
            console.log(`✅ Studenti generati: ${studentsData.count}`);
            
            // 5. Prepara output path
            tempOutputPath = path.join(this.tempOutputDir, `result_${sessionId}.json`);
            
            // 6. Esegui analisi Python
            const analysisResult = await this._executePythonAnalysis({
                imagePath: tempImagePath,
                studentsPath: tempStudentsJsonPath,
                outputPath: tempOutputPath,
                sessionId
            });
            
            console.log(`✅ Analisi completata: ${analysisResult.detected_faces} volti, ${analysisResult.recognized_students?.length || 0} riconosciuti`);
            
            // 7. Salva risultati nel database
            if (analysisResult.recognized_students && analysisResult.recognized_students.length > 0) {
                await this._saveAttendanceRecords(lessonId, analysisResult.recognized_students);
            }
            
            // 8. Converti l'immagine report in BLOB se esiste
            let reportImageBlob = null;
            if (analysisResult.report_image && fs.existsSync(analysisResult.report_image)) {
                try {
                    reportImageBlob = fs.readFileSync(analysisResult.report_image);
                    console.log(`✅ Report immagine convertita: ${reportImageBlob.length} bytes`);
                } catch (error) {
                    console.warn(`⚠️ Errore lettura report immagine: ${error.message}`);
                }
            }
            
            return {
                success: true,
                sessionId,
                reportImagePath: analysisResult.report_image,
                reportImageBlob: reportImageBlob, // BLOB dell'immagine con riquadri
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
            // Cleanup (esclude reportImagePath se esiste)
            const filesToCleanup = [
                tempImagePath,
                tempStudentsJsonPath,
                tempOutputPath,
                tempStudentsDir
            ];
            
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
                SELECT l.id, l.course_id, c.name as course_name, c.code as course_code
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
            // Query studenti del corso
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
            
            // Processa ogni studente
            const validStudents = [];
            
            for (const student of students) {
                try {
                    // Converti BLOB in file
                    let photoBuffer;
                    
                    if (Buffer.isBuffer(student.photoPath)) {
                        photoBuffer = student.photoPath;
                    } else if (typeof student.photoPath === 'string' && student.photoPath.length > 1000) {
                        photoBuffer = Buffer.from(student.photoPath, 'base64');
                    } else {
                        console.warn(`⚠️ Foto non valida per ${student.name} ${student.surname}`);
                        continue;
                    }
                    
                    // Salva foto temporanea
                    const photoPath = path.join(photosDir, `student_${student.id}.jpg`);
                    fs.writeFileSync(photoPath, photoBuffer);
                    
                    // Aggiungi a studenti validi
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
            
            // Salva JSON studenti
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
            
            // Timeout di 60 secondi
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
                // Log solo se non è un warning di TensorFlow
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
                
                // Leggi risultato
                try {
                    if (fs.existsSync(outputPath)) {
                        const resultData = fs.readFileSync(outputPath, 'utf8');
                        const result = JSON.parse(resultData);
                        resolve(result);
                    } else {
                        // Prova a parsare dall'output stdout
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
        console.log(`💾 Salvataggio presenze per ${recognizedStudents.length} studenti...`);
        
        try {
            const { Attendance } = require('../models');
            
            for (const student of recognizedStudents) {
                try {
                    // Cerca presenza esistente
                    let attendance = await Attendance.findOne({
                        where: { 
                            userId: student.userId, 
                            lessonId: lessonId 
                        }
                    });
                    
                    if (attendance) {
                        // Aggiorna
                        await attendance.update({
                            is_present: true,
                            confidence: student.confidence,
                            detection_method: 'face_recognition',
                            timestamp: new Date()
                        });
                    } else {
                        // Crea nuova
                        await Attendance.create({
                            userId: student.userId,
                            lessonId: lessonId,
                            is_present: true,
                            confidence: student.confidence,
                            detection_method: 'face_recognition',
                            timestamp: new Date()
                        });
                    }
                    
                    console.log(`✅ Presenza registrata per studente ${student.userId}`);
                    
                } catch (error) {
                    console.error(`❌ Errore salvataggio presenza per ${student.userId}:`, error.message);
                }
            }
            
        } catch (error) {
            console.error('❌ Errore salvataggio presenze:', error);
        }
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