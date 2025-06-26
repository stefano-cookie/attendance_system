const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { Lesson, Course, Subject, Classroom, User, Attendance, LessonImage, Screenshot, sequelize } = require('../models');
const { Op } = require('sequelize');

const enhancedCameraService = require('../services/enhancedCameraService');
const faceDetectionService = require('../services/faceDetectionService');

router.use(authenticate);

const isTeacher = (req, res, next) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ 
            success: false,
            message: 'Accesso riservato ai docenti' 
        });
    }
    next();
};

router.use(isTeacher);

// ====================================
// ENDPOINT BASE
// ====================================

/**
 * GET /api/teacher/test
 * Test endpoint
 */
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Teacher API funzionante!',
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role
        }
    });
});

/**
 * GET /api/teacher/dashboard
 * Dashboard principale teacher
 */
router.get('/dashboard', async (req, res) => {
    try {
        const teacherId = req.user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayLessons = await Lesson.findAll({
            where: {
                teacher_id: teacherId,
                lesson_date: {
                    [Op.gte]: today,
                    [Op.lt]: tomorrow
                }
            },
            include: [
                { model: Course, as: 'course', attributes: ['id', 'name'] },
                { model: Classroom, as: 'classroom', attributes: ['id', 'name', 'camera_ip'] },
                { model: Subject, as: 'subject', attributes: ['id', 'name'] }
            ],
            order: [['lesson_date', 'ASC']]
        });

        const stats = await Lesson.findAll({
            where: { teacher_id: teacherId },
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
                [sequelize.fn('SUM', sequelize.literal(`CASE WHEN status = 'completed' THEN 1 ELSE 0 END`)), 'completed'],
                [sequelize.fn('SUM', sequelize.literal(`CASE WHEN status = 'active' THEN 1 ELSE 0 END`)), 'active']
            ],
            raw: true
        });

        res.json({
            success: true,
            data: {
                teacher: {
                    id: req.user.id,
                    name: `${req.user.name} ${req.user.surname || ''}`.trim()
                },
                today: {
                    date: today.toISOString().split('T')[0],
                    lessons: todayLessons.map(lesson => ({
                        ...lesson.toJSON(),
                        classroom: {
                            ...lesson.classroom.toJSON(),
                            hasCamera: !!lesson.classroom.camera_ip
                        }
                    })),
                    count: todayLessons.length
                },
                stats: {
                    total_lessons: parseInt(stats[0]?.total || 0),
                    completed_lessons: parseInt(stats[0]?.completed || 0),
                    active_lessons: parseInt(stats[0]?.active || 0)
                }
            }
        });
    } catch (error) {
        console.error('❌ Errore dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Errore caricamento dashboard'
        });
    }
});

// ====================================
// GESTIONE LEZIONI
// ====================================

/**
 * POST /api/teacher/lessons
 * Crea nuova lezione
 */
router.post('/lessons', async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { name, lesson_date, course_id, subject_id, classroom_id } = req.body;

        console.log('📝 Creazione lezione teacher:', { 
            name, 
            lesson_date, 
            course_id, 
            subject_id,
            classroom_id, 
            teacherId 
        });

        if (!lesson_date || !course_id || !classroom_id) {
            return res.status(400).json({
                success: false,
                error: 'Data, corso e aula sono obbligatori'
            });
        }

        const lessonData = {
            name: name || `Lezione ${new Date(lesson_date).toLocaleDateString('it-IT')}`,
            lesson_date: new Date(lesson_date),
            course_id: parseInt(course_id),
            classroom_id: parseInt(classroom_id),
            teacher_id: teacherId,
            status: 'draft',
            attendance_mode: 'manual'
        };

        if (subject_id) {
            lessonData.subject_id = parseInt(subject_id);
        }

        if (Lesson.rawAttributes.duration_minutes) {
            lessonData.duration_minutes = 90;
        }
        if (Lesson.rawAttributes.face_detection_enabled) {
            lessonData.face_detection_enabled = true;
        }

        console.log('📋 Dati lezione da creare:', lessonData);

        const lesson = await Lesson.create(lessonData);

        console.log(`✅ Lezione creata con ID: ${lesson.id}`);

        const createdLesson = await Lesson.findByPk(lesson.id, {
            include: [
                { model: Course, as: 'course', attributes: ['id', 'name'] },
                { model: Classroom, as: 'classroom', attributes: ['id', 'name'] },
                { model: Subject, as: 'subject', attributes: ['id', 'name'], required: false }
            ]
        });

        res.status(201).json({
            success: true,
            lesson: createdLesson,
            message: 'Lezione creata con successo'
        });

    } catch (error) {
        console.error('❌ Errore creazione lezione - Dettaglio:', error);
        console.error('❌ Stack trace:', error.stack);
        
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                error: 'Errore validazione dati',
                details: error.errors.map(e => ({
                    field: e.path,
                    message: e.message
                }))
            });
        }
        
        if (error.name === 'SequelizeDatabaseError') {
            return res.status(400).json({
                success: false,
                error: 'Errore database',
                details: error.message,
                hint: 'Verifica che tutti i campi siano corretti'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Errore durante la creazione della lezione',
            details: error.message
        });
    }
});

/**
 * GET /api/teacher/lessons/:id
 * Dettaglio lezione
 */
router.get('/lessons/:id', async (req, res) => {
    try {
        const lessonId = req.params.id;
        
        const lesson = await Lesson.findOne({
            where: { id: lessonId },
            include: [
                { model: Course, as: 'course' },
                { model: Classroom, as: 'classroom' },
                { model: Subject, as: 'subject', required: false }
            ]
        });

        if (!lesson) {
            return res.status(404).json({
                success: false,
                error: 'Lezione non trovata'
            });
        }

        res.json({
            success: true,
            lesson
        });
    } catch (error) {
        console.error('❌ Errore caricamento lezione:', error);
        res.status(500).json({
            success: false,
            error: 'Errore caricamento lezione'
        });
    }
});

/**
 * GET /api/teacher/lessons/:id/attendance-report
 * Report presenze
 */
router.get('/lessons/:id/attendance-report', async (req, res) => {
    try {
        const lessonId = req.params.id;
        
        console.log(`📊 Report presenze per lezione ${lessonId}`);

        const lesson = await Lesson.findOne({
            where: { id: lessonId },
            include: [
                { model: Course, as: 'course' },
                { model: Classroom, as: 'classroom' },
                { model: Subject, as: 'subject', required: false }
            ]
        });

        if (!lesson) {
            return res.status(404).json({
                success: false,
                error: 'Lezione non trovata'
            });
        }

        const analyzedImages = await LessonImage.count({
            where: { 
                lesson_id: lessonId,
                is_analyzed: true
            }
        });

        if (analyzedImages === 0) {
            return res.json({
                success: true,
                data: {
                    lesson: {
                        id: lesson.id,
                        name: lesson.name,
                        date: lesson.lesson_date,
                        course: lesson.course?.name,
                        classroom: lesson.classroom?.name
                    },
                    attendance: {
                        students: [],
                        summary: {
                            total: 0,
                            present: 0,
                            absent: 0,
                            percentage: 0
                        },
                        last_updated: null
                    },
                    message: 'Nessuna analisi disponibile. Clicca "Scatta e Analizza" per iniziare.'
                }
            });
        }

        const attendances = await Attendance.findAll({
            where: { lessonId },
            include: [{
                model: User,
                as: 'student',
                attributes: ['id', 'name', 'surname', 'matricola'],
                required: false
            }]
        });

        const allStudents = await User.findAll({
            where: {
                courseId: lesson.course_id,
                role: 'student'
            },
            attributes: ['id', 'name', 'surname', 'matricola']
        });

        const attendanceMap = new Map();
        attendances.forEach(att => {
            attendanceMap.set(att.userId, att);
        });

        const students = allStudents.map(student => {
            const attendance = attendanceMap.get(student.id);
            return {
                student_id: student.id,
                student_name: student.name,
                student_surname: student.surname,
                matricola: student.matricola,
                is_present: attendance?.is_present || false,
                confidence: attendance?.confidence || 0,
                detection_method: attendance?.detection_method || null
            };
        });

        const present = students.filter(s => s.is_present).length;
        const total = students.length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        res.json({
            success: true,
            data: {
                lesson: {
                    id: lesson.id,
                    name: lesson.name,
                    date: lesson.lesson_date,
                    course: lesson.course?.name,
                    classroom: lesson.classroom?.name
                },
                attendance: {
                    students,
                    summary: {
                        total,
                        present,
                        absent: total - present,
                        percentage
                    },
                    last_updated: attendances.length > 0 ? attendances[0].createdAt : new Date()
                }
            }
        });

    } catch (error) {
        console.error('❌ Errore report presenze:', error);
        res.status(500).json({
            success: false,
            error: 'Errore generazione report'
        });
    }
});

/**
 * POST /api/teacher/lessons/:id/capture-and-analyze
 * Scatta foto e analizza presenze
 */
router.post('/lessons/:id/capture-and-analyze', async (req, res) => {
    try {
        const lessonId = req.params.id;
        
        console.log(`\n📸 CAPTURE AND ANALYZE per lezione ${lessonId}`);
        
        req.setTimeout(120000);
        res.setTimeout(120000);

        const lesson = await Lesson.findOne({
            where: { id: lessonId },
            include: [
                { model: Course, as: 'course' },
                { model: Classroom, as: 'classroom' }
            ]
        });

        if (!lesson) {
            return res.status(404).json({
                success: false,
                error: 'Lezione non trovata'
            });
        }

        console.log('📸 Scatto da camera...');
        const captureResult = await enhancedCameraService.captureImage(lesson.classroom_id);
        
        if (!captureResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Errore scatto camera',
                details: captureResult.error
            });
        }

        console.log(`✅ Scatto completato: ${(captureResult.imageData.length/1024).toFixed(1)}KB`);

        const savedImage = await LessonImage.create({
            lesson_id: lessonId,
            image_data: captureResult.imageData,
            file_size: captureResult.imageData.length,
            mime_type: 'image/jpeg',
            source: 'camera',
            captured_at: new Date(),
            camera_ip: lesson.classroom.camera_ip,
            camera_method: captureResult.metadata.method,
            is_analyzed: false,
            processing_status: 'pending'
        });

        console.log(`💾 Immagine salvata: ID ${savedImage.id}`);

        let analysisResult = {
            success: false,
            detected_faces: 0,
            recognized_students: []
        };

        try {
            console.log('🔍 Avvio analisi face detection...');
            
            analysisResult = await faceDetectionService.analyzeImageBlob(
                captureResult.imageData,
                lessonId,
                { debugMode: true }
            );

            console.log(`✅ Analisi completata: ${analysisResult.detected_faces} volti, ${analysisResult.recognized_students?.length || 0} riconosciuti`);

            await savedImage.update({
                is_analyzed: true,
                detected_faces: analysisResult.detected_faces || 0,
                recognized_faces: analysisResult.recognized_students?.length || 0,
                processing_status: analysisResult.success ? 'completed' : 'failed',
                analyzed_at: new Date()
            });

            // Salva l'immagine report con i riquadri se disponibile
            if (analysisResult.reportImageBlob) {
                try {
                    const reportImage = await LessonImage.create({
                        lesson_id: lessonId,
                        image_data: analysisResult.reportImageBlob,
                        file_size: analysisResult.reportImageBlob.length,
                        mime_type: 'image/jpeg',
                        source: 'face_detection_report',
                        captured_at: new Date(),
                        camera_ip: lesson.classroom.camera_ip,
                        is_analyzed: true,
                        detected_faces: analysisResult.detected_faces || 0,
                        recognized_faces: analysisResult.recognized_students?.length || 0,
                        processing_status: 'completed',
                        analyzed_at: new Date()
                    });
                    
                    console.log(`✅ Immagine report salvata: ID ${reportImage.id}`);
                } catch (reportError) {
                    console.warn('⚠️ Errore salvataggio immagine report:', reportError.message);
                }
            }

        } catch (analysisError) {
            console.error('❌ Errore face detection:', analysisError);
            
            await savedImage.update({
                is_analyzed: true,
                processing_status: 'error',
                error_message: analysisError.message
            });
        }

        try {
            await Screenshot.create({
                lessonId: lessonId,
                image_data: captureResult.imageData,
                timestamp: new Date(),
                detectedFaces: analysisResult.detected_faces || 0,
                source: 'camera_capture'
            });
        } catch (e) {
            console.warn('⚠️ Errore salvataggio screenshot:', e.message);
        }

        res.json({
            success: true,
            message: 'Scatto e analisi completati',
            image_id: savedImage.id,
            analysis: {
                detected_faces: analysisResult.detected_faces || 0,
                recognized_students: analysisResult.recognized_students?.length || 0,
                students: analysisResult.recognized_students || []
            },
            camera: {
                method: captureResult.metadata.method,
                file_size: captureResult.imageData.length
            }
        });

    } catch (error) {
        console.error('❌ ERRORE capture-and-analyze:', error);
        
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'Errore interno del server',
                details: error.message
            });
        }
    }
});

/**
 * GET /api/teacher/lessons/:id/images
 * Lista immagini lezione
 */
router.get('/lessons/:id/images', async (req, res) => {
    try {
        const lessonId = req.params.id;
        
        const images = await LessonImage.findAll({
            where: { lesson_id: lessonId },
            attributes: [
                'id', 'source', 'captured_at', 'is_analyzed',
                'detected_faces', 'recognized_faces', 'camera_ip'
            ],
            order: [['captured_at', 'DESC']]
        });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const imagesWithUrls = images.map(img => ({
            ...img.toJSON(),
            url: `${baseUrl}/api/images/lesson/${img.id}`,
            thumbnail_url: `${baseUrl}/api/images/lesson/${img.id}`
        }));

        res.json({
            success: true,
            images: imagesWithUrls
        });
        
    } catch (error) {
        console.error('❌ Errore lista immagini:', error);
        res.status(500).json({
            success: false,
            error: 'Errore caricamento immagini'
        });
    }
});

// ====================================
// DATI DI SUPPORTO
// ====================================

/**
 * GET /api/teacher/courses
 * Lista corsi
 */
router.get('/courses', async (req, res) => {
    try {
        const courses = await Course.findAll({
            attributes: ['id', 'name'],
            order: [['name', 'ASC']]
        });

        res.json({
            success: true,
            courses
        });
    } catch (error) {
        console.error('❌ Errore caricamento corsi:', error);
        res.status(500).json({
            success: false,
            error: 'Errore caricamento corsi'
        });
    }
});

/**
 * GET /api/teacher/classrooms
 * Lista aule
 */
router.get('/classrooms', async (req, res) => {
    try {
        const classrooms = await Classroom.findAll({
            attributes: ['id', 'name', 'camera_ip'],
            order: [['name', 'ASC']]
        });

        res.json({
            success: true,
            classrooms: classrooms.map(c => ({
                id: c.id,
                name: c.name,
                hasCamera: !!c.camera_ip
            }))
        });
    } catch (error) {
        console.error('❌ Errore caricamento aule:', error);
        res.status(500).json({
            success: false,
            error: 'Errore caricamento aule'
        });
    }
});

/**
 * GET /api/teacher/subjects
 * Lista materie per corso
 */
router.get('/subjects', async (req, res) => {
    try {
        const { course_id } = req.query;
        
        const whereClause = {};
        if (course_id) {
            whereClause.course_id = parseInt(course_id);
        }

        const subjects = await Subject.findAll({
            where: whereClause,
            attributes: ['id', 'name', 'course_id'],
            order: [['name', 'ASC']]
        });

        res.json({
            success: true,
            subjects
        });
    } catch (error) {
        console.error('❌ Errore caricamento materie:', error);
        res.status(500).json({
            success: false,
            error: 'Errore nel caricamento delle materie'
        });
    }
});

/**
 * GET /api/teacher/system-status
 * Verifica stato sistema
 */
router.get('/system-status', async (req, res) => {
    try {
        const faceDetectionStatus = await faceDetectionService.checkStatus();
        
        res.json({
            success: true,
            status: {
                faceDetection: faceDetectionStatus,
                camera: {
                    service: 'ready',
                    configured: true
                }
            }
        });
    } catch (error) {
        console.error('❌ Errore verifica sistema:', error);
        res.status(500).json({
            success: false,
            error: 'Errore verifica sistema'
        });
    }
});

module.exports = router;