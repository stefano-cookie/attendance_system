const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const path = require('path');
const db = require(path.join(__dirname, '../models/index'));
const { sequelize } = db;
const { QueryTypes } = require('sequelize');
const fs = require('fs');
const { Lesson, Course } = require('../models');
const fileAnalysisService = require('../services/fileAnalysisService');

const multer = require('multer');
const imageStorageService = require('../services/imageStorageService');
const enhancedCameraService = require('../services/enhancedCameraService');

const router = express.Router();

const upload = multer({
    dest: 'temp/',
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo file immagine sono permessi'), false);
        }
    }
});

const tempDir = path.join(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('📁 Directory temp creata:', tempDir);
}


router.get('/python-script-status', async (req, res) => {
    try {
        // Importa faceDetectionService
        const faceDetectionService = require('../services/faceDetectionService');
        
        // Usa il metodo checkStatus per verificare lo stato
        const status = await faceDetectionService.checkStatus();
        
        res.json({
            status: status,
            message: status.pythonScriptExists ? 
                'Script Python trovato correttamente' : 
                'Script Python NON trovato, verifica la posizione'
        });
    } catch (error) {
        console.error('Errore nel test dello script Python:', error);
        res.status(500).json({ 
            message: 'Errore nel test dello script Python',
            error: error.message
        });
    }
});

router.get('/', authenticate, async (req, res) => {
    try {
        console.log('GET /lessons - Recupero lezioni');
        const { courseId, subjectId, classroomId, startDate, endDate } = req.query;
        const userRole = req.user.role;
        const userId = req.user.id;
        
        let query = `
            SELECT l.id, l.name, l.lesson_date, l.course_id, l.subject_id, l.classroom_id, l.teacher_id,
                   l.is_completed, l.completed_at,
                   c.name as course_name,
                   s.name as subject_name,
                   cl.name as classroom_name
            FROM "Lessons" l
            LEFT JOIN "Courses" c ON l.course_id = c.id
            LEFT JOIN "Subjects" s ON l.subject_id = s.id
            LEFT JOIN "Classrooms" cl ON l.classroom_id = cl.id
            WHERE 1=1
        `;
        
        const replacements = {};
        
        if (userRole === 'teacher') {
            query += ` AND l.teacher_id = :teacherId`;
            replacements.teacherId = userId;
            console.log(`🎓 Filtering lessons for teacher ID: ${userId}`);
        }
        
        if (courseId) {
            query += ` AND l.course_id = :courseId`;
            replacements.courseId = courseId;
        }
        
        if (subjectId) {
            query += ` AND l.subject_id = :subjectId`;
            replacements.subjectId = subjectId;
        }
        
        if (classroomId) {
            query += ` AND l.classroom_id = :classroomId`;
            replacements.classroomId = classroomId;
        }
        
        if (startDate && endDate) {
            query += ` AND l.lesson_date BETWEEN :startDate AND :endDate`;
            replacements.startDate = startDate;
            replacements.endDate = endDate;
        }
        
        query += ` ORDER BY l.lesson_date DESC`;
        
        const lessons = await sequelize.query(query, {
            replacements,
            type: QueryTypes.SELECT
        });
        
        const formattedLessons = lessons.map(lesson => ({
            id: lesson.id,
            name: lesson.name,
            lesson_date: lesson.lesson_date,
            course_id: lesson.course_id,
            subject_id: lesson.subject_id,
            classroom_id: lesson.classroom_id,
            teacher_id: lesson.teacher_id,
            is_completed: lesson.is_completed,
            completed_at: lesson.completed_at,
            course: lesson.course_id ? {
                id: lesson.course_id,
                name: lesson.course_name
            } : null,
            subject: lesson.subject_id ? {
                id: lesson.subject_id,
                name: lesson.subject_name
            } : null,
            classroom: lesson.classroom_id ? {
                id: lesson.classroom_id,
                name: lesson.classroom_name
            } : null
        }));
        
        console.log(`Trovate ${formattedLessons.length} lezioni`);
        
        res.json(formattedLessons);
    } catch (error) {
        console.error('Errore nel recupero delle lezioni:', error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/directory-info/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const [lesson] = await sequelize.query(`
      SELECT l.id, l.name, l.lesson_date, l.course_id, 
             c.name as course_name
      FROM "Lessons" l
      LEFT JOIN "Courses" c ON l.course_id = c.id
      WHERE l.id = :id
    `, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (!lesson) {
      return res.status(404).json({ message: 'Lezione non trovata' });
    }
    
    const courseName = lesson.course_name || `Corso_${lesson.course_id}`;
    const lessonName = lesson.name || `Lezione_${id}`;
    
    const { imagesPath, reportsPath } = fileAnalysisService.ensureLessonDirectories(
      courseName, 
      lessonName
    );
    
    let imageFiles = [];
    let reportFiles = [];
    
    if (fs.existsSync(imagesPath)) {
      imageFiles = fs.readdirSync(imagesPath)
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png'].includes(ext);
        });
    }
    
    if (fs.existsSync(reportsPath)) {
      reportFiles = fs.readdirSync(reportsPath)
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.json'].includes(ext);
        });
    }
    
    res.json({
      lesson_id: lesson.id,
      course_id: lesson.course_id,
      lesson_name: lesson.name,
      course_name: lesson.course_name,
      directories: {
        images: {
          path: imagesPath,
          exists: fs.existsSync(imagesPath),
          fileCount: imageFiles.length,
          files: imageFiles
        },
        reports: {
          path: reportsPath,
          exists: fs.existsSync(reportsPath),
          fileCount: reportFiles.length,
          files: reportFiles
        }
      }
    });
  } catch (error) {
    console.error('Errore nel recupero delle directory della lezione:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/create-directories/:id', authenticate, async (req, res) => {
  try {
    const lessonId = req.params.id;
    
    const [lesson] = await sequelize.query(`
      SELECT l.id, l.name, l.course_id, c.name as course_name
      FROM "Lessons" l
      LEFT JOIN "Courses" c ON l.course_id = c.id
      WHERE l.id = :id
    `, {
      replacements: { id: lessonId },
      type: QueryTypes.SELECT
    });
    
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lezione non trovata' });
    }
    
    const courseName = lesson.course_name || `Corso_${lesson.course_id}`;
    const lessonName = lesson.name || `Lezione_${lessonId}`;
    
    const { imagesPath, reportsPath } = fileAnalysisService.ensureLessonDirectories(
      courseName, 
      lessonName
    );
    
    res.json({
      success: true,
      message: 'Directory create con successo',
      paths: {
        images: imagesPath,
        reports: reportsPath
      }
    });
  } catch (error) {
    console.error('Errore nella creazione delle directory:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Errore nella creazione delle directory',
      error: error.message
    });
  }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        const userId = req.user.id;
        
        let query = `
            SELECT l.id, l.name, l.lesson_date, l.course_id, l.subject_id, l.classroom_id, l.teacher_id,
                   c.name as course_name,
                   s.name as subject_name,
                   cl.name as classroom_name
            FROM "Lessons" l
            LEFT JOIN "Courses" c ON l.course_id = c.id
            LEFT JOIN "Subjects" s ON l.subject_id = s.id
            LEFT JOIN "Classrooms" cl ON l.classroom_id = cl.id
            WHERE l.id = :id
        `;
        
        const replacements = { id };
        
        if (userRole === 'teacher') {
            query += ` AND l.teacher_id = :teacherId`;
            replacements.teacherId = userId;
        }
        
        const [lesson] = await sequelize.query(query, {
            replacements,
            type: QueryTypes.SELECT
        });
        
        if (!lesson) {
            return res.status(404).json({ message: 'Lezione non trovata' });
        }
        
        const formattedLesson = {
            id: lesson.id,
            name: lesson.name,
            lesson_date: lesson.lesson_date,
            course_id: lesson.course_id,
            subject_id: lesson.subject_id,
            classroom_id: lesson.classroom_id,
            course: lesson.course_id ? {
                id: lesson.course_id,
                name: lesson.course_name
            } : null,
            subject: lesson.subject_id ? {
                id: lesson.subject_id,
                name: lesson.subject_name
            } : null,
            classroom: lesson.classroom_id ? {
                id: lesson.classroom_id,
                name: lesson.classroom_name
            } : null
        };
        
        res.json(formattedLesson);
    } catch (error) {
        console.error('Errore nel recupero della lezione:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/', authenticate, async (req, res) => {
    try {
        const { name, lesson_date, course_id, subject_id, classroom_id, teacher_id, planned_start_time, planned_end_time } = req.body;
        
        console.log('POST /lessons - Dati ricevuti:', { 
            name, lesson_date, course_id, subject_id, classroom_id, teacher_id, planned_start_time, planned_end_time 
        });
        
        if (!name || !lesson_date || !course_id || !subject_id) {
            return res.status(400).json({ 
                message: 'Nome, data, corso e materia sono obbligatori'
            });
        }
        
        const { Lesson, Course, Subject, Classroom } = require('../models');
        const { Op } = require('sequelize');
        
        if (classroom_id) {
            let startTime, endTime;
            
            if (planned_start_time && planned_end_time) {
                const lessonDate = new Date(lesson_date).toISOString().split('T')[0];
                startTime = new Date(`${lessonDate}T${planned_start_time}`);
                endTime = new Date(`${lessonDate}T${planned_end_time}`);
            } else {
                const lessonDateTime = new Date(lesson_date);
                startTime = new Date(lessonDateTime);
                endTime = new Date(lessonDateTime);
                endTime.setMinutes(endTime.getMinutes() + 90);
            }

            console.log(`🔍 Checking classroom ${classroom_id} availability for ${startTime.toISOString()} - ${endTime.toISOString()}`);

            const conflictingLessons = await Lesson.findAll({
                where: {
                    classroom_id: parseInt(classroom_id),
                    [Op.or]: [
                        {
                            planned_start_time: {
                                [Op.lt]: endTime
                            },
                            planned_end_time: {
                                [Op.gt]: startTime
                            }
                        },
                        {
                            planned_start_time: null,
                            lesson_date: {
                                [Op.gte]: startTime,
                                [Op.lt]: endTime
                            }
                        }
                    ]
                },
                attributes: ['id', 'name', 'lesson_date', 'planned_start_time', 'planned_end_time'],
                include: [
                    { model: Course, as: 'course', attributes: ['name'] }
                ]
            });

            if (conflictingLessons.length > 0) {
                const conflict = conflictingLessons[0];
                
                return res.status(409).json({
                    success: false,
                    message: 'Aula non disponibile nell\'orario selezionato',
                    error: `L'aula è già occupata da una lezione del corso "${conflict.course?.name || 'Corso sconosciuto'}" alle ${conflict.lesson_date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`,
                    conflicting_lesson: {
                        id: conflict.id,
                        name: conflict.name,
                        date: conflict.lesson_date,
                        course: conflict.course?.name
                    }
                });
            }

            console.log('✅ Classroom available, creating lesson');
        }
        
        const lessonData = {
            name,
            lesson_date,
            course_id,
            subject_id,
            classroom_id: classroom_id || null,
            teacher_id: teacher_id || null
        };

        if (planned_start_time && planned_end_time) {
            const lessonDate = new Date(lesson_date).toISOString().split('T')[0];
            lessonData.planned_start_time = new Date(`${lessonDate}T${planned_start_time}`);
            lessonData.planned_end_time = new Date(`${lessonDate}T${planned_end_time}`);
        }

        const newLesson = await Lesson.create(lessonData);
        
        console.log(`✅ Lezione creata con ID: ${newLesson.id}`);
        
        const lessonWithRelations = await Lesson.findByPk(newLesson.id, {
            include: [
                {
                    model: Course,
                    as: 'course',
                    attributes: ['id', 'name']
                },
                {
                    model: Subject,
                    as: 'subject',
                    attributes: ['id', 'name']
                },
                {
                    model: Classroom,
                    as: 'classroom',
                    attributes: ['id', 'name']
                }
            ]
        });
        
        const sanitizeFileName = (name) => {
            return name
                .replace(/[^\w\s-]/gi, '')
                .trim()
                .replace(/\s+/g, '_');
        };
        
        try {
            const dataDir = path.join(process.cwd(), '..', '..', 'data');
            const courseName = sanitizeFileName(lessonWithRelations.course?.name || `Corso_${course_id}`);
            const lessonName = sanitizeFileName(name);
            
            const imageDir = path.join(dataDir, 'classroom_images', courseName, lessonName);
            if (!fs.existsSync(imageDir)) {
                fs.mkdirSync(imageDir, { recursive: true });
                console.log(`📁 Creata directory immagini: ${imageDir}`);
            }
            
            const reportDir = path.join(dataDir, 'reports', courseName, lessonName);
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
                console.log(`📁 Creata directory report: ${reportDir}`);
            }
        } catch (error) {
            console.warn('⚠️ Errore nella creazione delle directory per la lezione:', error);
        }
        
        const formattedLesson = {
            id: lessonWithRelations.id,
            name: lessonWithRelations.name,
            lesson_date: lessonWithRelations.lesson_date,
            course_id: lessonWithRelations.course_id,
            subject_id: lessonWithRelations.subject_id,
            classroom_id: lessonWithRelations.classroom_id,
            course: lessonWithRelations.course,
            subject: lessonWithRelations.subject,
            classroom: lessonWithRelations.classroom,
            createdAt: lessonWithRelations.createdAt,
            updatedAt: lessonWithRelations.updatedAt
        };
        
        console.log('✅ Lezione creata con successo:', formattedLesson.id);
        
        res.status(201).json(formattedLesson);
    } catch (error) {
        console.error('❌ Errore nella creazione della lezione:', error);
        res.status(500).json({ 
            message: 'Errore nella creazione della lezione',
            error: error.message 
        });
    }
});

router.put('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, lesson_date, course_id, subject_id, classroom_id } = req.body;
        
        console.log('PUT /lessons/:id - Dati ricevuti:', { 
            id, name, lesson_date, course_id, subject_id, classroom_id 
        });
        
        const { Lesson, Course, Subject, Classroom } = require('../models');
        
        const existingLesson = await Lesson.findByPk(id);
        
        if (!existingLesson) {
            return res.status(404).json({ message: 'Lezione non trovata' });
        }
        
        await existingLesson.update({
            name, 
            lesson_date, 
            course_id, 
            subject_id, 
            classroom_id: classroom_id || null
        });
        
        console.log(`✅ Lezione ${id} aggiornata con successo`);
        
        const updatedLesson = await Lesson.findByPk(id, {
            include: [
                {
                    model: Course,
                    as: 'course',
                    attributes: ['id', 'name']
                },
                {
                    model: Subject,
                    as: 'subject',
                    attributes: ['id', 'name']
                },
                {
                    model: Classroom,
                    as: 'classroom',
                    attributes: ['id', 'name']
                }
            ]
        });
        
        const formattedLesson = {
            id: updatedLesson.id,
            name: updatedLesson.name,
            lesson_date: updatedLesson.lesson_date,
            course_id: updatedLesson.course_id,
            subject_id: updatedLesson.subject_id,
            classroom_id: updatedLesson.classroom_id,
            course: updatedLesson.course,
            subject: updatedLesson.subject,
            classroom: updatedLesson.classroom,
            createdAt: updatedLesson.createdAt,
            updatedAt: updatedLesson.updatedAt
        };
        
        res.json(formattedLesson);
    } catch (error) {
        console.error('❌ Errore generale PUT:', error);
        res.status(500).json({ 
            message: 'Errore generale nella richiesta',
            error: error.message 
        });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [lesson] = await sequelize.query(`
            SELECT id FROM "Lessons" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });
        
        if (!lesson) {
            return res.status(404).json({ message: 'Lezione non trovata' });
        }
        
        console.log(`🗑️ Preservando dati correlati per lezione ${id}...`);
        
        try {
            await sequelize.query(`
                UPDATE "LessonImages" SET lesson_id = NULL WHERE lesson_id = :id
            `, {
                replacements: { id },
                type: QueryTypes.UPDATE
            });
            console.log('✅ LessonImages aggiornate');
        } catch (error) {
            console.warn('⚠️ Impossibile aggiornare LessonImages:', error.message);
        }
        
        try {
            await sequelize.query(`
                UPDATE "Screenshots" SET "lessonId" = NULL WHERE "lessonId" = :id
            `, {
                replacements: { id },
                type: QueryTypes.UPDATE
            });
            console.log('✅ Screenshots aggiornati');
        } catch (error) {
            console.warn('⚠️ Impossibile aggiornare Screenshots:', error.message);
        }
        
        console.log('📊 Attendance records saranno preservati automaticamente con lessonId = NULL');
        
        await sequelize.query(`
            DELETE FROM "Lessons" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.DELETE
        });
        
        console.log(`✅ Lezione ${id} eliminata, dati correlati preservati quando possibile`);
        res.json({ 
            message: 'Lezione eliminata con successo',
            note: 'I report, screenshot e dati storici sono stati preservati' 
        });
    } catch (error) {
        console.error('Errore nell\'eliminazione della lezione:', error);
        res.status(500).json({ message: error.message });
    }
});

// ========================================
// ========================================

router.post('/:id/analyze', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`\n🚀 POST /lessons/${id}/analyze - Avvio analisi presenze`);
        console.log(`Storage mode: ${process.env.IMAGE_STORAGE_MODE || 'hybrid'}`);
        console.log(`=====================================`);
        
        const [lesson] = await sequelize.query(`
            SELECT l.id, l.name as lesson_name, l.course_id, c.name as course_name
            FROM "Lessons" l
            LEFT JOIN "Courses" c ON l.course_id = c.id
            WHERE l.id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });
        
        if (!lesson) {
            console.error(`❌ Lezione con ID ${id} non trovata`);
            return res.status(404).json({ message: 'Lezione non trovata' });
        }
        
        console.log(`📚 Lezione trovata:`, {
            id: lesson.id,
            lesson_name: lesson.lesson_name,
            course_id: lesson.course_id,
            course_name: lesson.course_name
        });
        
        let imageInfo = null;
        let analysisResult = null;
        
        try {
            console.log('🔄 Tentativo recupero immagine dal database...');
            imageInfo = await imageStorageService.getImageForAnalysis(id);
            console.log(`✅ Immagine recuperata da: ${imageInfo.source}`);
            
            analysisResult = await fileAnalysisService.analyzeLessonImages(
                id, 
                lesson.course_name,
                lesson.lesson_name,
                imageInfo.imagePath
            );
            
            if (imageInfo.isTemporary) {
                await imageStorageService.cleanupTemporaryFiles(imageInfo.imagePath);
                console.log('🧹 File temporaneo pulito');
            }
            
            if (imageInfo.source === 'database' && imageInfo.imageId) {
                const { LessonImage } = require('../models');
                await LessonImage.update(
                    { is_analyzed: true },
                    { where: { id: imageInfo.imageId } }
                );
                console.log(`✅ Immagine ${imageInfo.imageId} marcata come analizzata`);
            }
            
        } catch (dbError) {
            console.log('⚠️ Database fallito, provo filesystem tradizionale...');
            console.log('   Errore database:', dbError.message);
            
            analysisResult = await fileAnalysisService.analyzeLessonImages(
                id, 
                lesson.course_name,
                lesson.lesson_name
            );
        }
        
        if (!analysisResult) {
            return res.status(500).json({
                success: false,
                message: 'Errore durante l\'analisi',
                error: 'Nessun risultato dall\'analisi'
            });
        }
        
        console.log(`✅ Analisi completata con successo`);
        
        res.json({
            message: 'Analisi completata',
            results: analysisResult,
            source: imageInfo ? imageInfo.source : 'filesystem',
            hybrid_mode: true
        });
        
    } catch (error) {
        console.error('❌ Errore analisi:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

router.get('/:id/directories', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [lesson] = await sequelize.query(`
            SELECT l.id, l.name, l.course_id, c.name as course_name
            FROM "Lessons" l
            LEFT JOIN "Courses" c ON l.course_id = c.id
            WHERE l.id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });
        
        if (!lesson) {
            return res.status(404).json({ message: 'Lezione non trovata' });
        }
        
        const courseName = lesson.course_name || `Corso_${lesson.course_id}`;
        const lessonName = lesson.name || `Lezione_${id}`;
        
        const { imagesPath, reportsPath } = fileAnalysisService.ensureLessonDirectories(
            courseName, 
            lessonName
        );
        
        let imageFiles = [];
        let reportFiles = [];
        
        if (fs.existsSync(imagesPath)) {
            imageFiles = fs.readdirSync(imagesPath)
                .filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return ['.jpg', '.jpeg', '.png'].includes(ext);
                });
        }
        
        if (fs.existsSync(reportsPath)) {
            reportFiles = fs.readdirSync(reportsPath)
                .filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return ['.jpg', '.jpeg', '.png', '.json'].includes(ext);
                });
        }
        
        res.json({
            lesson_id: lesson.id,
            course_id: lesson.course_id,
            lesson_name: lesson.name,
            course_name: lesson.course_name,
            directories: {
                images: {
                    path: imagesPath,
                    exists: fs.existsSync(imagesPath),
                    fileCount: imageFiles.length,
                    files: imageFiles
                },
                reports: {
                    path: reportsPath,
                    exists: fs.existsSync(reportsPath),
                    fileCount: reportFiles.length,
                    files: reportFiles
                }
            }
        });
    } catch (error) {
        console.error('Errore nel recupero delle directory della lezione:', error);
        res.status(500).json({ message: error.message });
    }
});

// ========================================
// ========================================

router.post('/:id/upload-manual', authenticate, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`📁 Upload manuale per lezione ${id}`);
        
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'Nessuna immagine caricata' 
            });
        }
        
        console.log(`📎 File ricevuto: ${req.file.originalname}, size: ${req.file.size} bytes`);
        
        const imageBuffer = await imageStorageService.fileToBlob(req.file.path);
        const imageId = await imageStorageService.saveLessonImage(id, imageBuffer, 'manual');
        
        fs.unlinkSync(req.file.path);
        console.log(`🧹 File temporaneo rimosso: ${req.file.path}`);
        
        console.log(`✅ Upload completato, imageId: ${imageId}`);
        
        res.json({
            success: true,
            imageId: imageId,
            message: 'Immagine caricata nel database con successo',
            originalName: req.file.originalname,
            size: req.file.size,
            optimizedSize: imageBuffer.length
        });
    } catch (error) {
        console.error('❌ Errore upload manuale:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

router.post('/:id/capture-camera', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`📷 Scatto camera per lezione ${id}`);
        
        const [lesson] = await sequelize.query(`
            SELECT l.id, l.name as lesson_name, l.classroom_id,
                   cl.name as classroom_name, cl.camera_ip
            FROM "Lessons" l
            LEFT JOIN "Classrooms" cl ON l.classroom_id = cl.id
            WHERE l.id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });
        
        if (!lesson) {
            return res.status(404).json({ 
                success: false,
                error: 'Lezione non trovata' 
            });
        }
        
        if (!lesson.classroom_id) {
            return res.status(400).json({ 
                success: false,
                error: 'Lezione non ha aula associata' 
            });
        }
        
        if (!lesson.camera_ip) {
            return res.status(400).json({ 
                success: false,
                error: `Nessuna camera configurata per l'aula ${lesson.classroom_name}` 
            });
        }
        
        console.log(`🏫 Lezione: "${lesson.lesson_name}" in aula "${lesson.classroom_name}" (IP: ${lesson.camera_ip})`);
        
        const result = await enhancedCameraService.captureImage(lesson.classroom_id);
        
        if (result.success) {
            const imageId = await imageStorageService.saveLessonImage(
                id,                      // lesson_id
                result.imageData,        // buffer dell'immagine
                'camera'                 // source
            );
            
            console.log(`✅ Scatto completato con successo!`);
            console.log(`   - Metodo: ${result.metadata.method}`);
            console.log(`   - Dimensione: ${(result.metadata.fileSize / 1024).toFixed(1)}KB`);
            console.log(`   - Image ID database: ${imageId}`);
            
            res.json({
                success: true,
                imageId: imageId,
                message: 'Foto acquisita con successo dalla camera IP',
                data: {
                    lesson: {
                        id: lesson.id,
                        name: lesson.lesson_name,
                        classroom: lesson.classroom_name
                    },
                    camera: {
                        ip: lesson.camera_ip,
                        method: result.metadata.method,
                        fileSize: result.metadata.fileSize,
                        resolution: result.metadata.resolution,
                        timestamp: result.metadata.timestamp
                    }
                }
            });
        } else {
            console.error(`❌ Errore scatto camera: ${result.error}`);
            
            res.status(400).json({
                success: false,
                error: result.error,
                details: 'Verificare che la camera sia accesa e raggiungibile'
            });
        }
        
    } catch (error) {
        console.error('❌ Errore endpoint capture-camera:', error);
        res.status(500).json({ 
            success: false,
            error: 'Errore interno del server',
            details: error.message
        });
    }
});

router.get('/:id/images', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { LessonImage } = require('../models');
        
        const images = await LessonImage.findAll({
            where: { lesson_id: id },
            order: [['captured_at', 'DESC']],
            attributes: ['id', 'source', 'captured_at', 'is_analyzed']
        });
        
        res.json({
            success: true,
            lessonId: id,
            images: images,
            count: images.length
        });
    } catch (error) {
        console.error('❌ Errore recupero immagini lezione:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

router.delete('/:id/images/:imageId', authenticate, async (req, res) => {
    try {
        const { id, imageId } = req.params;
        
        const { LessonImage } = require('../models');
        
        const deleted = await LessonImage.destroy({
            where: { 
                id: imageId,
                lesson_id: id 
            }
        });
        
        if (deleted) {
            res.json({
                success: true,
                message: 'Immagine eliminata con successo'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Immagine non trovata'
            });
        }
    } catch (error) {
        console.error('❌ Errore eliminazione immagine:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// ========================================
// ========================================

router.get('/debug/system-status', authenticate, async (req, res) => {
    try {
        const faceDetectionService = require('../services/faceDetectionService');
        const fileAnalysisService = require('../services/fileAnalysisService');
        const emailService = require('../services/emailService');
        
        const faceDetectionStatus = await faceDetectionService.checkStatus();
        const recognitionSystemStatus = await fileAnalysisService.checkRecognitionSystem();
        const emailStatus = await emailService.checkConfiguration();
        
        const [studentsCount] = await sequelize.query(`
            SELECT COUNT(*) as count FROM "Users" WHERE role = 'student'
        `, { type: QueryTypes.SELECT });
        
        const [studentsWithPhotos] = await sequelize.query(`
            SELECT COUNT(*) as count FROM "Users" 
            WHERE role = 'student' AND "photoPath" IS NOT NULL AND "photoPath" != ''
        `, { type: QueryTypes.SELECT });
        
        const [lessonsCount] = await sequelize.query(`
            SELECT COUNT(*) as count FROM "Lessons"
        `, { type: QueryTypes.SELECT });
        
        const [coursesCount] = await sequelize.query(`
            SELECT COUNT(*) as count FROM "Courses"
        `, { type: QueryTypes.SELECT });
        
        const [lessonImagesCount] = await sequelize.query(`
            SELECT COUNT(*) as count FROM "LessonImages"
        `, { type: QueryTypes.SELECT });
        
        res.json({
            faceDetection: faceDetectionStatus,
            recognitionSystem: recognitionSystemStatus,
            email: emailStatus,
            database: {
                students: studentsCount.count,
                studentsWithPhotos: studentsWithPhotos.count,
                lessons: lessonsCount.count,
                courses: coursesCount.count,
                lessonImages: lessonImagesCount.count
            },
            storage: {
                mode: process.env.IMAGE_STORAGE_MODE || 'hybrid',
                database_enabled: true,
                filesystem_enabled: true
            },
            summary: {
                ready: faceDetectionStatus.ready && recognitionSystemStatus.ready,
                emailReady: emailStatus.success,
                message: faceDetectionStatus.ready && recognitionSystemStatus.ready ? 
                    'Sistema completamente operativo' : 
                    'Sistema non pronto - controlla i dettagli',
                emailMessage: emailStatus.success ? 
                    'Email configurate' : 
                    'Email non configurate - optional'
            }
        });
    } catch (error) {
        console.error('Errore debug system status:', error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
});

router.post('/debug/test-image', authenticate, async (req, res) => {
    try {
        const { imagePath, lessonId } = req.body;
        
        if (!imagePath || !lessonId) {
            return res.status(400).json({
                error: 'imagePath e lessonId sono richiesti'
            });
        }
        
        const faceDetectionService = require('../services/faceDetectionService');
        
        console.log(`Test immagine: ${imagePath} per lezione ${lessonId}`);
        
        const result = await faceDetectionService.processImage(imagePath, lessonId, {
            debugMode: true,
            bypassEnhancement: false
        });
        
        res.json({
            success: true,
            result: result,
            message: result.success ? 
                'Test completato con successo' : 
                'Test fallito - controlla i logs'
        });
    } catch (error) {
        console.error('Errore test immagine:', error);
        res.status(500).json({ 
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

router.post('/debug/create-test-data', authenticate, async (req, res) => {
    try {
        const { courseId, lessonName } = req.body;
        
        if (!courseId) {
            return res.status(400).json({
                error: 'courseId è richiesto'
            });
        }
        
        const testLessonName = lessonName || `Lezione Test ${Date.now()}`;
        
        const [lesson] = await sequelize.query(`
            INSERT INTO "Lessons" (name, lesson_date, course_id, subject_id)
            VALUES (:name, NOW(), :courseId, NULL)
            RETURNING id, name
        `, {
            replacements: { 
                name: testLessonName,
                courseId: courseId
            },
            type: QueryTypes.INSERT
        });
        
        if (!lesson || lesson.length === 0) {
            throw new Error('Impossibile creare lezione di test');
        }
        
        const lessonId = lesson[0].id;
        
        const fileAnalysisService = require('../services/fileAnalysisService');
        
        const [courseInfo] = await sequelize.query(`
            SELECT name FROM "Courses" WHERE id = :courseId
        `, {
            replacements: { courseId },
            type: QueryTypes.SELECT
        });
        
        const courseName = courseInfo ? courseInfo.name : `Corso_${courseId}`;
        
        const { imagesPath, reportsPath } = fileAnalysisService.ensureLessonDirectories(
            courseName,
            testLessonName
        );
        
        res.json({
            success: true,
            lesson: {
                id: lessonId,
                name: testLessonName,
                courseId: courseId,
                courseName: courseName
            },
            directories: {
                images: imagesPath,
                reports: reportsPath
            },
            message: `Lezione di test creata. Carica immagini in: ${imagesPath}`
        });
    } catch (error) {
        console.error('Errore creazione dati test:', error);
        res.status(500).json({ 
            success: false,
            error: error.message
        });
    }
});

router.get('/debug/list-files/:lessonId', authenticate, async (req, res) => {
    try {
        const { lessonId } = req.params;
        
        const [lesson] = await sequelize.query(`
            SELECT l.id, l.name, l.course_id, c.name as course_name
            FROM "Lessons" l
            LEFT JOIN "Courses" c ON l.course_id = c.id
            WHERE l.id = :lessonId
        `, {
            replacements: { lessonId },
            type: QueryTypes.SELECT
        });
        
        if (!lesson) {
            return res.status(404).json({ error: 'Lezione non trovata' });
        }
        
        const fileAnalysisService = require('../services/fileAnalysisService');
        
        const sanitizeName = (name) => name ? name.replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_') : '';
        const courseName = sanitizeName(lesson.course_name || `Corso_${lesson.course_id}`);
        const lessonName = sanitizeName(lesson.name || `Lezione_${lessonId}`);
        
        const { imagesPath, reportsPath } = fileAnalysisService.ensureLessonDirectories(
            courseName,
            lessonName
        );
        
        let imageFiles = [];
        let reportFiles = [];
        
        if (fs.existsSync(imagesPath)) {
            imageFiles = fs.readdirSync(imagesPath)
                .filter(file => ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase()))
                .map(file => ({
                    name: file,
                    path: path.join(imagesPath, file),
                    size: fs.statSync(path.join(imagesPath, file)).size
                }));
        }
        
        if (fs.existsSync(reportsPath)) {
            reportFiles = fs.readdirSync(reportsPath)
                .map(file => ({
                    name: file,
                    path: path.join(reportsPath, file),
                    size: fs.statSync(path.join(reportsPath, file)).size
                }));
        }
        
        const students = await sequelize.query(`
            SELECT id, name, surname, matricola, "photoPath"
            FROM "Users" 
            WHERE role = 'student' AND "courseId" = :courseId
        `, {
            replacements: { courseId: lesson.course_id },
            type: QueryTypes.SELECT
        });
        
        const { LessonImage } = require('../models');
        const dbImages = await LessonImage.findAll({
            where: { lesson_id: lessonId },
            attributes: ['id', 'source', 'captured_at', 'is_analyzed']
        });
        
        res.json({
            lesson: {
                id: lesson.id,
                name: lesson.name,
                courseId: lesson.course_id,
                courseName: lesson.course_name
            },
            directories: {
                images: {
                    path: imagesPath,
                    exists: fs.existsSync(imagesPath),
                    files: imageFiles
                },
                reports: {
                    path: reportsPath,
                    exists: fs.existsSync(reportsPath),
                    files: reportFiles
                }
            },
            database: {
                images: dbImages
            },
            students: students.map(s => ({
                id: s.id,
                name: `${s.name} ${s.surname}`,
                matricola: s.matricola,
                hasPhoto: !!s.photoPath,
                photoPath: s.photoPath
            })),
            summary: {
                filesystemImages: imageFiles.length,
                databaseImages: dbImages.length,
                reportsCount: reportFiles.length,
                studentsCount: students.length,
                studentsWithPhotos: students.filter(s => s.photoPath).length
            }
        });
    } catch (error) {
        console.error('Errore list files:', error);
        res.status(500).json({ 
            error: error.message
        });
    }
});

router.get('/debug/email-config-test', authenticate, async (req, res) => {
    try {
        const emailService = require('../services/emailService');
        const result = await emailService.checkConfiguration();
        
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/debug/test-email/:lessonId', authenticate, async (req, res) => {
    try {
        const { lessonId } = req.params;
        const emailService = require('../services/emailService');
        
        const result = await emailService.sendAttendanceReportToAllStudents(lessonId);
        
        res.json({
            success: result.success,
            message: result.success ? 'Email inviate con successo' : 'Errore invio email',
            results: result.results || null,
            error: result.error || null
        });
    } catch (error) {
        console.error('Errore test email:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

module.exports = router;