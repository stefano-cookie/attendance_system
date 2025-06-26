// backend/src/services/imageStorageService.js - VERSIONE CORRETTA SENZA IMPORT CIRCOLARI
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

class ImageStorageService {
    constructor() {
        this.storageMode = process.env.IMAGE_STORAGE_MODE || 'hybrid'; // file, database, hybrid
        console.log('🔍 ImageStorageService inizializzato:');
        console.log('   Storage mode:', this.storageMode);
        
        // NON importiamo i modelli nel constructor per evitare circolarità
        this._models = null;
    }

    // Lazy loading dei modelli per evitare import circolari
    _getModels() {
        if (!this._models) {
            try {
                // Import lazy dei modelli quando necessario
                this._models = require('../models');
                console.log('✅ Modelli caricati in ImageStorageService');
            } catch (error) {
                console.error('❌ Errore caricamento modelli in ImageStorageService:', error);
                throw new Error('Impossibile caricare i modelli del database');
            }
        }
        return this._models;
    }

    // Converte file in BLOB
    async fileToBlob(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File non trovato: ${filePath}`);
            }

            // Ottimizza immagine prima di salvare
            const optimizedBuffer = await sharp(filePath)
                .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer();
            
            console.log(`📦 File ottimizzato: ${filePath} → ${(optimizedBuffer.length / 1024).toFixed(1)}KB`);
            return optimizedBuffer;
        } catch (sharpError) {
            console.warn('⚠️ Sharp fallito, uso lettura diretta:', sharpError.message);
            // Fallback: leggi file direttamente
            return fs.readFileSync(filePath);
        }
    }

    // Salva immagine lezione nel database
    async saveLessonImage(lessonId, imageBuffer, source = 'manual', metadata = {}) {
        try {
            const models = this._getModels();
            const { LessonImage } = models;

            if (!LessonImage) {
                throw new Error('Modello LessonImage non disponibile');
            }

            if (!Buffer.isBuffer(imageBuffer)) {
                throw new Error('imageBuffer deve essere un Buffer');
            }

            const lessonImage = await LessonImage.create({
                lesson_id: lessonId,
                image_data: imageBuffer,
                source: source,
                captured_at: new Date(),
                file_size: imageBuffer.length,
                mime_type: metadata.mime_type || 'image/jpeg',
                original_filename: metadata.original_filename || null,
                camera_ip: metadata.camera_ip || null,
                is_analyzed: false
            });
            
            console.log(`✅ Immagine lezione salvata nel database: ID ${lessonImage.id}, Size: ${(imageBuffer.length / 1024).toFixed(1)}KB`);
            return lessonImage.id;
        } catch (error) {
            console.error('❌ Errore salvataggio immagine lezione:', error);
            throw error;
        }
    }

    // Carica immagine lezione dal database
    async getLessonImage(imageId) {
        try {
            const models = this._getModels();
            const { LessonImage } = models;

            const lessonImage = await LessonImage.findByPk(imageId);
            if (!lessonImage) {
                throw new Error(`Immagine con ID ${imageId} non trovata`);
            }
            
            if (!lessonImage.image_data) {
                throw new Error(`Immagine ${imageId} non ha dati BLOB`);
            }

            console.log(`✅ Immagine ${imageId} caricata dal database: ${(lessonImage.image_data.length / 1024).toFixed(1)}KB`);
            return lessonImage.image_data;
        } catch (error) {
            console.error(`❌ Errore caricamento immagine ${imageId}:`, error);
            throw error;
        }
    }

    // Salva screenshot nel database
    async saveScreenshot(lessonId, imageBuffer, source = 'manual_upload', metadata = {}) {
        try {
            const models = this._getModels();
            const { Screenshot } = models;

            if (!Screenshot) {
                throw new Error('Modello Screenshot non disponibile');
            }

            if (!Buffer.isBuffer(imageBuffer)) {
                throw new Error('imageBuffer deve essere un Buffer');
            }

            const screenshot = await Screenshot.create({
                lessonId: lessonId,
                image_data: imageBuffer,
                source: source,
                timestamp: new Date(),
                file_size: imageBuffer.length,
                mime_type: metadata.mime_type || 'image/jpeg',
                original_filename: metadata.original_filename || null,
                detectedFaces: metadata.detectedFaces || 0
            });
            
            console.log(`✅ Screenshot salvato nel database: ID ${screenshot.id}, Size: ${(imageBuffer.length / 1024).toFixed(1)}KB`);
            return screenshot.id;
        } catch (error) {
            console.error('❌ Errore salvataggio screenshot:', error);
            throw error;
        }
    }

    // Modalità ibrida: prova database, fallback su file
    async getImageForAnalysis(lessonId, forceSource = null) {
        try {
            console.log(`🔍 Ricerca immagine per analisi lezione ${lessonId}, modalità: ${this.storageMode}`);

            if (forceSource === 'filesystem' || this.storageMode === 'file') {
                return this._getImageFromFilesystem(lessonId);
            }
            
            if (forceSource === 'database' || this.storageMode === 'database') {
                return this._getImageFromDatabase(lessonId);
            }
            
            // Modalità hybrid: prova prima database
            try {
                console.log('🔄 Tentativo database...');
                return await this._getImageFromDatabase(lessonId);
            } catch (dbError) {
                console.log('🔄 Database fallito, provo filesystem...');
                console.log('   Errore database:', dbError.message);
                return this._getImageFromFilesystem(lessonId);
            }
        } catch (error) {
            console.error('❌ Errore recupero immagine per analisi:', error);
            throw error;
        }
    }

    async _getImageFromDatabase(lessonId) {
        const models = this._getModels();
        const { LessonImage } = models;

        const lessonImage = await LessonImage.findOne({
            where: { 
                lesson_id: lessonId,
                is_analyzed: false 
            },
            order: [['captured_at', 'DESC']]
        });
        
        if (!lessonImage) {
            throw new Error('Nessuna immagine non analizzata trovata nel database');
        }

        if (!lessonImage.image_data) {
            throw new Error('Immagine trovata ma senza dati BLOB');
        }
        
        // Crea file temporaneo per Python script
        const tempPath = path.join(__dirname, '../../temp', `lesson_${lessonId}_${Date.now()}.jpg`);
        
        // Assicura che la directory temp esista
        const tempDir = path.dirname(tempPath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        fs.writeFileSync(tempPath, lessonImage.image_data);
        
        console.log(`✅ Immagine database convertita in file temporaneo: ${tempPath}`);
        
        return {
            imagePath: tempPath,
            imageId: lessonImage.id,
            source: 'database',
            isTemporary: true,
            fileSize: lessonImage.image_data.length
        };
    }

    async _getImageFromFilesystem(lessonId) {
        // Usa il servizio esistente per la gestione filesystem
        try {
            const fileAnalysisService = require('./fileAnalysisService');
            
            // Ottieni info lezione per costruire il percorso
            const models = this._getModels();
            const { sequelize } = models;
            const { QueryTypes } = require('sequelize');

            const [lesson] = await sequelize.query(`
                SELECT l.id, l.name as lesson_name, l.course_id, c.name as course_name
                FROM "Lessons" l
                LEFT JOIN "Courses" c ON l.course_id = c.id
                WHERE l.id = :lessonId
            `, {
                replacements: { lessonId },
                type: QueryTypes.SELECT
            });

            if (!lesson) {
                throw new Error(`Lezione ${lessonId} non trovata`);
            }

            // Costruisci percorso filesystem usando fileAnalysisService
            const courseName = lesson.course_name || `Corso_${lesson.course_id}`;
            const lessonName = lesson.lesson_name || `Lezione_${lessonId}`;

            const { imagesPath } = fileAnalysisService.ensureLessonDirectories(courseName, lessonName);
            
            // Cerca file immagine nella directory
            if (!fs.existsSync(imagesPath)) {
                throw new Error(`Directory immagini non trovata: ${imagesPath}`);
            }

            const imageFiles = fs.readdirSync(imagesPath)
                .filter(file => ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase()))
                .sort((a, b) => {
                    // Ordina per data modifica, più recente prima
                    const statA = fs.statSync(path.join(imagesPath, a));
                    const statB = fs.statSync(path.join(imagesPath, b));
                    return statB.mtime - statA.mtime;
                });

            if (imageFiles.length === 0) {
                throw new Error(`Nessuna immagine trovata in: ${imagesPath}`);
            }

            const selectedImage = path.join(imagesPath, imageFiles[0]);
            console.log(`✅ Immagine filesystem trovata: ${selectedImage}`);

            return {
                imagePath: selectedImage,
                source: 'filesystem',
                isTemporary: false,
                fileSize: fs.statSync(selectedImage).size
            };

        } catch (error) {
            console.error('❌ Errore recupero filesystem:', error);
            throw error;
        }
    }

    // Pulisce file temporanei
    async cleanupTemporaryFiles(filePath) {
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🧹 File temporaneo rimosso: ${filePath}`);
            }
        } catch (error) {
            console.error('❌ Errore pulizia file temporaneo:', error);
        }
    }

    // Ottieni statistiche storage
    async getStorageStats() {
        try {
            const models = this._getModels();
            const { LessonImage, Screenshot } = models;

            const [lessonImagesCount] = await models.sequelize.query(`
                SELECT COUNT(*) as count FROM "LessonImages" WHERE image_data IS NOT NULL
            `, { type: models.sequelize.QueryTypes.SELECT });

            const [screenshotsCount] = await models.sequelize.query(`
                SELECT COUNT(*) as count FROM "Screenshots" WHERE image_data IS NOT NULL
            `, { type: models.sequelize.QueryTypes.SELECT });

            const [totalBlobSize] = await models.sequelize.query(`
                SELECT 
                    COALESCE(SUM(LENGTH(image_data)), 0) as total_size
                FROM (
                    SELECT image_data FROM "LessonImages" WHERE image_data IS NOT NULL
                    UNION ALL
                    SELECT image_data FROM "Screenshots" WHERE image_data IS NOT NULL
                ) as all_images
            `, { type: models.sequelize.QueryTypes.SELECT });

            return {
                lessonImages: lessonImagesCount.count,
                screenshots: screenshotsCount.count,
                totalImages: lessonImagesCount.count + screenshotsCount.count,
                totalSizeMB: Math.round(totalBlobSize.total_size / (1024 * 1024) * 100) / 100,
                storageMode: this.storageMode
            };
        } catch (error) {
            console.error('❌ Errore statistiche storage:', error);
            return {
                lessonImages: 0,
                screenshots: 0,
                totalImages: 0,
                totalSizeMB: 0,
                storageMode: this.storageMode,
                error: error.message
            };
        }
    }

    // Test del sistema storage
    async testStorage() {
        try {
            console.log('🧪 Test sistema storage...');
            
            // Test 1: Modelli disponibili
            const models = this._getModels();
            const hasLessonImage = !!models.LessonImage;
            const hasScreenshot = !!models.Screenshot;

            // Test 2: Connessione database
            await models.sequelize.authenticate();

            // Test 3: Directory temporanea
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const stats = await this.getStorageStats();

            return {
                success: true,
                modelsAvailable: hasLessonImage && hasScreenshot,
                databaseConnection: true,
                tempDirectory: fs.existsSync(tempDir),
                storageMode: this.storageMode,
                stats: stats,
                message: 'Sistema storage operativo'
            };
        } catch (error) {
            console.error('❌ Test storage fallito:', error);
            return {
                success: false,
                error: error.message,
                message: 'Sistema storage non operativo'
            };
        }
    }
}

module.exports = new ImageStorageService();