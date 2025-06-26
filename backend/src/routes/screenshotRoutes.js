const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

const router = express.Router();

function buildScreenshotUrl(screenshot, req) {
    if (!screenshot) return null;
    
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    if (screenshot.image_data && screenshot.image_data.length > 0) {
        return `${baseUrl}/api/images/screenshot/${screenshot.id}`;
    }
    
    if (screenshot.path) {
        if (screenshot.path.startsWith('http')) {
            return screenshot.path;
        }
        
        const reportsDir = '/Users/stebbi/attendance-system/data/reports';
        
        let relativePath;
        if (screenshot.path.includes(reportsDir)) {
            relativePath = screenshot.path.replace(reportsDir, '').replace(/^\/+/, '');
        } else if (screenshot.path.includes('/data/reports/')) {
            const parts = screenshot.path.split('/data/reports/');
            relativePath = parts[1] || screenshot.path;
        } else {
            relativePath = screenshot.path.split('/').pop();
        }
        
        return `${baseUrl}/static/screenshots/${relativePath}`;
    }
    
    return null;
}

router.get('/debug', authenticate, async (req, res) => {
    try {
        const columns = await sequelize.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'Screenshots'
            ORDER BY ordinal_position
        `, {
            type: QueryTypes.SELECT
        });
        
        const screenshots = await sequelize.query(`
            SELECT * FROM "Screenshots" LIMIT 10
        `, {
            type: QueryTypes.SELECT
        });
        
        const reportsDir = path.join(process.cwd(), '../../data/reports');
        let reportFiles = [];
        
        if (fs.existsSync(reportsDir)) {
            reportFiles = fs.readdirSync(reportsDir)
                .filter(file => file.endsWith('.jpg') || file.endsWith('.png'))
                .map(file => ({
                    name: file,
                    path: path.join(reportsDir, file),
                    size: fs.statSync(path.join(reportsDir, file)).size
                }));
        }
        
        res.json({
            columns,
            screenshotsCount: screenshots.length,
            screenshots,
            reportsDir,
            reportFilesCount: reportFiles.length,
            reportFiles: reportFiles.slice(0, 10),
            message: 'Debug Screenshots'
        });
    } catch (error) {
        console.error('Errore debug:', error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/screenshots', authenticate, async (req, res) => {
    try {
        console.log('GET /api/admin/screenshots - Inizio elaborazione');
        const { lessonId, startDate, endDate, include } = req.query;
        
        const includeRelations = include ? include.split(',') : [];
        const includeLesson = includeRelations.includes('lesson');
        const includeClassroom = includeRelations.includes('classroom');
        
        let query = `
            SELECT s.id, s.path, s."lessonId", s.timestamp, s."detectedFaces",
                   s.image_data, s.source, s.mime_type, s.file_size, s.original_filename
        `;
        
        if (includeLesson) {
            query += `, 
                l.id as lesson_id, l.name as lesson_name, l.lesson_date as lesson_date
            `;
        }
        
        if (includeClassroom && includeLesson) {
            query += `, 
                c.id as classroom_id, c.name as classroom_name
            `;
        }
        
        query += ` FROM "Screenshots" s`;
        
        if (includeLesson) {
            query += ` LEFT JOIN "Lessons" l ON s."lessonId" = l.id`;
        }
        
        if (includeClassroom && includeLesson) {
            query += ` LEFT JOIN "Classrooms" c ON l.classroom_id = c.id`;
        }
        
        query += ` WHERE 1=1`;
        
        const replacements = {};
        
        if (lessonId) {
            query += ` AND s."lessonId" = :lessonId`;
            replacements.lessonId = lessonId;
        }
        
        if (startDate && endDate) {
            query += ` AND s.timestamp BETWEEN :startDate AND :endDate`;
            replacements.startDate = startDate;
            replacements.endDate = endDate;
        }
        
        query += ` ORDER BY s.timestamp DESC`;
        
        console.log('Query SQL:', query);
        console.log('Replacements:', replacements);
        
        const screenshots = await sequelize.query(query, {
            replacements,
            type: QueryTypes.SELECT
        });
        
        console.log(`Trovati ${screenshots.length} screenshots`);
        
        const formattedScreenshots = screenshots.map(screenshot => {
            const result = {
                id: screenshot.id,
                path: screenshot.path,
                lessonId: screenshot.lessonId,
                timestamp: screenshot.timestamp,
                detectedFaces: screenshot.detectedFaces,
                source: screenshot.source || 'filesystem',
                mimeType: screenshot.mime_type || 'image/jpeg',
                fileSize: screenshot.file_size,
                originalFilename: screenshot.original_filename,
                hasImageData: !!(screenshot.image_data && screenshot.image_data.length > 0)
            };
            
            result.url = buildScreenshotUrl(screenshot, req);
            
            if (result.hasImageData) {
                result.downloadUrl = `${req.protocol}://${req.get('host')}/api/images/download/screenshot/${screenshot.id}`;
            }
            
            if (includeLesson && screenshot.lesson_id) {
                result.lesson = {
                    id: screenshot.lesson_id,
                    name: screenshot.lesson_name,
                    date: screenshot.lesson_date
                };
            }
            
            if (includeClassroom && screenshot.classroom_id) {
                result.classroom = {
                    id: screenshot.classroom_id,
                    name: screenshot.classroom_name
                };
            }
            
            return result;
        });
        
        res.json({ 
            success: true,
            data: formattedScreenshots,
            total: formattedScreenshots.length,
            screenshots: formattedScreenshots
        });
    } catch (error) {
        console.error('Errore nel recupero degli screenshots:', error);
        res.status(500).json({ 
            message: error.message,
            stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
        });
    }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [screenshot] = await sequelize.query(`
            SELECT s.id, s.path, s."lessonId", s.timestamp, s."detectedFaces",
                   s.image_data, s.source, s.mime_type, s.file_size, s.original_filename,
                   l.id as lesson_id, l.name as lesson_name,
                   c.id as classroom_id, c.name as classroom_name
            FROM "Screenshots" s
            LEFT JOIN "Lessons" l ON s."lessonId" = l.id
            LEFT JOIN "Classrooms" c ON l.classroom_id = c.id
            WHERE s.id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });
        
        if (!screenshot) {
            return res.status(404).json({ message: 'Screenshot non trovato' });
        }
        
        const url = buildScreenshotUrl(screenshot, req);
        
        const formattedScreenshot = {
            id: screenshot.id,
            path: screenshot.path,
            url: url,
            lessonId: screenshot.lessonId,
            timestamp: screenshot.timestamp,
            detectedFaces: screenshot.detectedFaces,
            source: screenshot.source || 'filesystem',
            mimeType: screenshot.mime_type || 'image/jpeg',
            fileSize: screenshot.file_size,
            originalFilename: screenshot.original_filename,
            hasImageData: !!(screenshot.image_data && screenshot.image_data.length > 0),
            downloadUrl: screenshot.image_data && screenshot.image_data.length > 0 ? 
                `${req.protocol}://${req.get('host')}/api/images/download/screenshot/${screenshot.id}` : null,
            lesson: screenshot.lesson_id ? {
                id: screenshot.lesson_id,
                name: screenshot.lesson_name
            } : null,
            classroom: screenshot.classroom_id ? {
                id: screenshot.classroom_id,
                name: screenshot.classroom_name
            } : null
        };
        
        res.json(formattedScreenshot);
    } catch (error) {
        console.error('Errore nel recupero dello screenshot:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/import', authenticate, async (req, res) => {
    try {
        const { directory, lessonId } = req.body;
        
        if (!directory || !lessonId) {
            return res.status(400).json({ message: 'Directory e lessonId sono obbligatori' });
        }
        
        const [lesson] = await sequelize.query(`
            SELECT id FROM "Lessons" WHERE id = :lessonId
        `, {
            replacements: { lessonId },
            type: QueryTypes.SELECT
        });
        
        if (!lesson) {
            return res.status(404).json({ message: 'Lezione non trovata' });
        }
        
        const sourceDir = path.resolve(process.cwd(), directory);
        if (!fs.existsSync(sourceDir)) {
            return res.status(404).json({ message: `Directory ${directory} non trovata` });
        }
        
        const files = fs.readdirSync(sourceDir);
        console.log(`Trovati ${files.length} file in ${sourceDir}`);
        
        const importedScreenshots = [];
        
        for (const file of files) {
            const fileExt = path.extname(file).toLowerCase();
            if (!fileExt.match(/\.(jpg|jpeg|png|gif|webp)$/)) continue;
            
            const filePath = path.join(sourceDir, file);
            
            const [existing] = await sequelize.query(`
                SELECT id FROM "Screenshots" WHERE path = :filePath
            `, {
                replacements: { filePath },
                type: QueryTypes.SELECT
            });
            
            if (existing) {
                console.log(`File ${file} già presente nel database`);
                continue;
            }
            
            const stats = fs.statSync(filePath);
            const timestamp = stats.mtime;
            
            const [result] = await sequelize.query(`
                INSERT INTO "Screenshots" (path, "lessonId", timestamp, "detectedFaces", "createdAt", "updatedAt")
                VALUES (:path, :lessonId, :timestamp, :detectedFaces, NOW(), NOW())
                RETURNING id
            `, {
                replacements: { 
                    path: filePath,
                    lessonId,
                    timestamp,
                    detectedFaces: 0
                },
                type: QueryTypes.INSERT
            });
            
            importedScreenshots.push({
                id: result[0].id,
                filename: file,
                timestamp: timestamp
            });
        }
        
        res.status(201).json({
            message: `Importati ${importedScreenshots.length} screenshot`,
            screenshots: importedScreenshots
        });
    } catch (error) {
        console.error('Errore durante l\'importazione degli screenshot:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/', authenticate, async (req, res) => {
    try {
        const { path: imagePath, lessonId, timestamp, detectedFaces, imageData, source, mimeType, originalFilename } = req.body;
        
        if (!imagePath && !imageData) {
            return res.status(400).json({ message: 'Path o imageData sono obbligatori' });
        }
        
        if (!lessonId) {
            return res.status(400).json({ message: 'lessonId è obbligatorio' });
        }
        
        const [lesson] = await sequelize.query(`
            SELECT id FROM "Lessons" WHERE id = :lessonId
        `, {
            replacements: { lessonId },
            type: QueryTypes.SELECT
        });
        
        if (!lesson) {
            return res.status(404).json({ message: 'Lezione non trovata' });
        }
        
        const insertData = {
            lessonId: lessonId,
            timestamp: timestamp || new Date(),
            detectedFaces: detectedFaces || 0
        };
        
        if (imageData) {
            const imageBuffer = typeof imageData === 'string' && imageData.startsWith('data:') ?
                Buffer.from(imageData.split(',')[1], 'base64') :
                Buffer.from(imageData);
            
            insertData.image_data = imageBuffer;
            insertData.source = source || 'manual_upload';
            insertData.mime_type = mimeType || 'image/jpeg';
            insertData.file_size = imageBuffer.length;
            insertData.original_filename = originalFilename;
        } else {
            insertData.path = imagePath;
            insertData.source = 'filesystem';
        }
        
        const query = `
            INSERT INTO "Screenshots" (
                ${insertData.path ? 'path,' : ''}
                ${insertData.image_data ? 'image_data,' : ''}
                "lessonId", timestamp, "detectedFaces", source, 
                ${insertData.mime_type ? 'mime_type,' : ''}
                ${insertData.file_size ? 'file_size,' : ''}
                ${insertData.original_filename ? 'original_filename,' : ''}
                "createdAt", "updatedAt"
            )
            VALUES (
                ${insertData.path ? ':path,' : ''}
                ${insertData.image_data ? ':image_data,' : ''}
                :lessonId, :timestamp, :detectedFaces, :source,
                ${insertData.mime_type ? ':mime_type,' : ''}
                ${insertData.file_size ? ':file_size,' : ''}
                ${insertData.original_filename ? ':original_filename,' : ''}
                NOW(), NOW()
            )
            RETURNING id, path, "lessonId", timestamp, "detectedFaces", source, mime_type, file_size, original_filename
        `;
        
        const [result] = await sequelize.query(query, {
            replacements: insertData,
            type: QueryTypes.INSERT
        });
        
        const newScreenshot = result[0];
        newScreenshot.url = buildScreenshotUrl(newScreenshot, req);
        newScreenshot.hasImageData = !!(newScreenshot.image_data);
        
        if (newScreenshot.hasImageData) {
            newScreenshot.downloadUrl = `${req.protocol}://${req.get('host')}/api/images/download/screenshot/${newScreenshot.id}`;
        }
        
        res.status(201).json(newScreenshot);
    } catch (error) {
        console.error('Errore nel salvataggio dello screenshot:', error);
        res.status(500).json({ message: error.message });
    }
});

router.put('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { path: imagePath, lessonId, timestamp, detectedFaces } = req.body;
        
        const [screenshot] = await sequelize.query(`
            SELECT id FROM "Screenshots" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });
        
        if (!screenshot) {
            return res.status(404).json({ message: 'Screenshot non trovato' });
        }
        
        let query = `UPDATE "Screenshots" SET "updatedAt" = NOW()`;
        const replacements = { id };
        
        if (imagePath) {
            query += `, path = :path`;
            replacements.path = imagePath;
        }
        
        if (lessonId) {
            const [lesson] = await sequelize.query(`
                SELECT id FROM "Lessons" WHERE id = :lessonId
            `, {
                replacements: { lessonId },
                type: QueryTypes.SELECT
            });
            
            if (!lesson) {
                return res.status(404).json({ message: 'Lezione non trovata' });
            }
            
            query += `, "lessonId" = :lessonId`;
            replacements.lessonId = lessonId;
        }
        
        if (timestamp) {
            query += `, timestamp = :timestamp`;
            replacements.timestamp = timestamp;
        }
        
        if (detectedFaces !== undefined) {
            query += `, "detectedFaces" = :detectedFaces`;
            replacements.detectedFaces = detectedFaces;
        }
        
        query += ` WHERE id = :id RETURNING id, path, "lessonId", timestamp, "detectedFaces"`;
        
        const [result] = await sequelize.query(query, {
            replacements,
            type: QueryTypes.UPDATE
        });
        
        if (!result || result.length === 0) {
            return res.status(500).json({ message: 'Errore nell\'aggiornamento dello screenshot' });
        }
        
        const updatedScreenshot = result[0];
        updatedScreenshot.url = buildScreenshotUrl(updatedScreenshot, req);
        
        res.json(updatedScreenshot);
    } catch (error) {
        console.error('Errore nell\'aggiornamento dello screenshot:', error);
        res.status(500).json({ message: error.message });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [screenshot] = await sequelize.query(`
            SELECT id, path FROM "Screenshots" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });
        
        if (!screenshot) {
            return res.status(404).json({ message: 'Screenshot non trovato' });
        }
        
        await sequelize.query(`
            DELETE FROM "Screenshots" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.DELETE
        });
        
        const { deleteFile } = req.query;
        
        if (deleteFile === 'true' && screenshot.path && !screenshot.path.startsWith('http')) {
            try {
                if (fs.existsSync(screenshot.path)) {
                    fs.unlinkSync(screenshot.path);
                    console.log(`File eliminato: ${screenshot.path}`);
                }
            } catch (fileError) {
                console.error(`Errore nella rimozione del file: ${fileError.message}`);
            }
        }
        
        res.json({ 
            message: 'Screenshot eliminato con successo',
            fileRemoved: deleteFile === 'true'
        });
    } catch (error) {
        console.error('Errore nell\'eliminazione dello screenshot:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/link-to-lesson', authenticate, async (req, res) => {
    try {
        const { screenshotId, lessonId } = req.body;
        
        if (!screenshotId || !lessonId) {
            return res.status(400).json({ message: 'screenshotId e lessonId sono obbligatori' });
        }
        
        const [screenshot] = await sequelize.query(`
            SELECT id FROM "Screenshots" WHERE id = :screenshotId
        `, {
            replacements: { screenshotId },
            type: QueryTypes.SELECT
        });
        
        if (!screenshot) {
            return res.status(404).json({ message: 'Screenshot non trovato' });
        }
        
        const [lesson] = await sequelize.query(`
            SELECT id FROM "Lessons" WHERE id = :lessonId
        `, {
            replacements: { lessonId },
            type: QueryTypes.SELECT
        });
        
        if (!lesson) {
            return res.status(404).json({ message: 'Lezione non trovata' });
        }
        
        await sequelize.query(`
            UPDATE "Screenshots" 
            SET "lessonId" = :lessonId, "updatedAt" = NOW()
            WHERE id = :screenshotId
        `, {
            replacements: { screenshotId, lessonId },
            type: QueryTypes.UPDATE
        });
        
        await sequelize.query(`
            UPDATE "Attendances" 
            SET "lessonId" = :lessonId
            WHERE "screenshotId" = :screenshotId
        `, {
            replacements: { screenshotId, lessonId },
            type: QueryTypes.UPDATE
        });
        
        res.json({ 
            message: 'Screenshot collegato alla lezione con successo',
            screenshotId,
            lessonId
        });
    } catch (error) {
        console.error('Errore nel collegamento dello screenshot alla lezione:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * GET /api/images/lesson/:id
 * Serve singola immagine LessonImage dal database BLOB
 */
router.get('/lesson/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📸 Richiesta LessonImage ID: ${id}`);

    const { LessonImage } = require('../models');
    const lessonImage = await LessonImage.findByPk(id);

    if (!lessonImage) {
      console.log(`❌ LessonImage ${id} non trovata`);
      return res.status(404).json({
        success: false,
        error: 'Immagine non trovata'
      });
    }

    if (!lessonImage.image_data) {
      console.log(`❌ LessonImage ${id} senza dati BLOB`);
      return res.status(404).json({
        success: false,
        error: 'Dati immagine non disponibili'
      });
    }

    const mimeType = lessonImage.mime_type || 'image/jpeg';
    
    res.set({
      'Content-Type': mimeType,
      'Content-Length': lessonImage.image_data.length,
      'Cache-Control': 'public, max-age=86400',
      'Content-Disposition': `inline; filename="lesson_${lessonImage.lesson_id}_${id}.jpg"`
    });

    console.log(`✅ Serving LessonImage ${id}: ${mimeType}, ${lessonImage.image_data.length} bytes`);

    res.send(lessonImage.image_data);

  } catch (error) {
    console.error(`❌ Errore serving LessonImage ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;