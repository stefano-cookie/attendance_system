const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { Lesson, Course, Subject, Classroom, User, Attendance, LessonImage, Screenshot, StudentSubject, sequelize } = require('../models');
const { Op } = require('sequelize');

const enhancedCameraService = require('../services/enhancedCameraService');
const faceDetectionService = require('../services/faceDetectionService');
const emailService = require('../services/emailService');

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
            attributes: ['id', 'name', 'lesson_date', 'lesson_start', 'lesson_end', 'status', 'is_completed', 'completed_at', 'course_id', 'subject_id', 'classroom_id'],
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


router.post('/lessons', async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { name, lesson_date, lesson_start, lesson_end, course_id, subject_id, classroom_id } = req.body;

        console.log('📝 Creazione lezione teacher:', { 
            name, 
            lesson_date,
            lesson_start,
            lesson_end,
            course_id, 
            subject_id,
            classroom_id,
            teacherId 
        });

        if (!lesson_date || !lesson_start || !lesson_end || !course_id || !classroom_id) {
            return res.status(400).json({
                success: false,
                error: 'Data, orari, corso e aula sono obbligatori'
            });
        }

        // Costruisci l'oggetto Date per lesson_date usando lesson_start
        const lessonDateTime = new Date(`${lesson_date}T${lesson_start}`);
        
        const lessonData = {
            name: name || `Lezione ${new Date(lesson_date).toLocaleDateString('it-IT')}`,
            lesson_date: lessonDateTime,
            lesson_start: lesson_start,
            lesson_end: lesson_end,
            course_id: parseInt(course_id),
            classroom_id: parseInt(classroom_id),
            teacher_id: teacherId, // Sempre il docente loggato
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

        // Costruisci date/time per controllo conflitti usando i nuovi campi
        const startTime = new Date(`${lesson_date}T${lesson_start}`);
        const endTime = new Date(`${lesson_date}T${lesson_end}`);

        console.log(`🔍 Checking classroom ${classroom_id} availability for ${startTime.toISOString()} - ${endTime.toISOString()}`);

        // Trova lezioni che si sovrappongono nella stessa aula e stesso giorno
        const sameDay = lesson_date; // YYYY-MM-DD format
        const conflictingLessons = await Lesson.findAll({
            where: {
                classroom_id: parseInt(classroom_id),
                lesson_date: {
                    [Op.gte]: new Date(`${sameDay}T00:00:00`),
                    [Op.lt]: new Date(`${sameDay}T23:59:59`)
                }
            },
            attributes: ['id', 'name', 'lesson_date', 'lesson_start', 'lesson_end', 'teacher_id'],
            include: [
                { model: Course, as: 'course', attributes: ['name'] }
            ]
        });

        // Controlla sovrapposizioni temporali
        const hasTimeConflict = conflictingLessons.some(existingLesson => {
            const existingStart = existingLesson.lesson_start 
                ? new Date(`${sameDay}T${existingLesson.lesson_start}`) 
                : new Date(existingLesson.lesson_date);
            const existingEnd = existingLesson.lesson_end 
                ? new Date(`${sameDay}T${existingLesson.lesson_end}`)
                : new Date(existingStart.getTime() + 60 * 60 * 1000); // +1 ora di default
            
            // Verifica sovrapposizione: (start1 < end2) && (start2 < end1)
            return (startTime < existingEnd) && (existingStart < endTime);
        });

        if (hasTimeConflict) {
            const conflict = conflictingLessons[0];
            
            return res.status(409).json({
                success: false,
                error: 'Aula non disponibile nell\'orario selezionato',
                details: {
                    message: `L'aula è già occupata da una lezione del corso "${conflict.course?.name || 'Corso sconosciuto'}" dalle ${conflict.lesson_start || 'N/A'} alle ${conflict.lesson_end || 'N/A'}`,
                    conflicting_lesson: {
                        id: conflict.id,
                        name: conflict.name,
                        date: conflict.lesson_date,
                        start_time: conflict.lesson_start,
                        end_time: conflict.lesson_end,
                        course: conflict.course?.name,
                        teacher_id: conflict.teacher_id
                    }
                }
            });
        }

        console.log('✅ Classroom available, creating lesson');

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

        if (!lesson.canAccess('teacher')) {
            return res.status(403).json({
                success: false,
                error: 'Lezione completata - accesso non consentito',
                message: 'Questa lezione è stata completata e non è più modificabile.'
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

router.post('/lessons/:id/capture-and-analyze', async (req, res) => {
    try {
        const lessonId = req.params.id;
        
        console.log(`\n📸 CAPTURE AND ANALYZE per lezione ${lessonId}`);
        
        req.setTimeout(45000);   // 45 secondi
        res.setTimeout(45000);   // 45 secondi

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

        if (!lesson.canAccess('teacher')) {
            return res.status(403).json({
                success: false,
                error: 'Lezione completata - operazione non consentita',
                message: 'Questa lezione è stata completata e non è possibile scattare nuove foto.'
            });
        }

        console.log('📸 Scatto da camera...');
        const captureResult = await enhancedCameraService.captureImage(lesson.classroom_id);
        
        if (!captureResult.success) {
            // Aggiorna stato camera come errore dopo scatto fallito
            await lesson.classroom.update({ camera_status: 'error' });
            
            return res.status(500).json({
                success: false,
                error: 'Errore scatto camera',
                details: captureResult.error
            });
        }

        console.log(`✅ Scatto completato: ${(captureResult.imageData.length/1024).toFixed(1)}KB`);

        // Aggiorna stato camera come online dopo scatto riuscito
        await lesson.classroom.update({ camera_status: 'online' });

        // Salviamo sempre l'immagine originale come base, poi la sostituiremo con quella con i riquadri se disponibile
        const savedImage = await LessonImage.create({
            lesson_id: lessonId,
            image_data: captureResult.imageData,
            file_size: captureResult.imageData.length,
            mime_type: 'image/jpeg',
            source: 'camera',
            captured_at: new Date(),
            camera_ip: lesson.classroom.camera_ip,
            camera_method: captureResult.metadata.method,
            camera_metadata: {
                capture_source: 'teacher',
                teacher_id: req.user.id,
                teacher_name: `${req.user.name} ${req.user.surname || ''}`.trim(),
                teacher_email: req.user.email,
                captured_by_role: 'teacher',
                capture_timestamp: new Date().toISOString()
            },
            is_analyzed: false,
            processing_status: 'pending'
        });

        console.log(`💾 Immagine base salvata: ID ${savedImage.id}`);

        let analysisResult = {
            success: false,
            detected_faces: 0,
            recognized_students: []
        };
        
        // Non usiamo più reportImageId separato - l'immagine con i riquadri è ora savedImage

        try {
            console.log('🔍 Avvio analisi face detection...');
            
            analysisResult = await faceDetectionService.analyzeImageBlob(
                captureResult.imageData,
                lessonId,
                { debugMode: true, imageId: savedImage.id }
            );

            console.log(`✅ Analisi completata: ${analysisResult.detected_faces} volti, ${analysisResult.recognized_students?.length || 0} riconosciuti`);

            await savedImage.update({
                is_analyzed: true,
                detected_faces: analysisResult.detected_faces || 0,
                recognized_faces: analysisResult.recognized_students?.length || 0,
                processing_status: analysisResult.success ? 'completed' : 'failed',
                analyzed_at: new Date()
            });

            console.log(`\n💾 === SALVATAGGIO IMMAGINE REPORT ===`);
            console.log(`📊 Has reportImageBlob: ${!!analysisResult.reportImageBlob}`);
            if (analysisResult.reportImageBlob) {
                console.log(`📊 ReportImageBlob size: ${analysisResult.reportImageBlob.length} bytes`);
            }
            console.log(`📊 Has reportImagePath: ${!!analysisResult.reportImagePath}`);
            if (analysisResult.reportImagePath) {
                console.log(`📂 ReportImagePath: ${analysisResult.reportImagePath}`);
            }
            
            // Se l'analisi ha generato un'immagine con riquadri, sostituisci quella base
            if (analysisResult.reportImageBlob) {
                try {
                    await savedImage.update({
                        image_data: analysisResult.reportImageBlob,
                        file_size: analysisResult.reportImageBlob.length,
                        source: 'report',
                        is_analyzed: true,
                        detected_faces: analysisResult.detected_faces || 0,
                        recognized_faces: analysisResult.recognized_students?.length || 0,
                        processing_status: 'completed',
                        analyzed_at: new Date()
                    });
                    
                    console.log(`✅ Immagine aggiornata con riquadri: ID ${savedImage.id}`);
                } catch (reportError) {
                    console.error('❌ Errore aggiornamento immagine con riquadri:', reportError.message);
                    // Manteniamo l'immagine originale se l'update fallisce
                    await savedImage.update({
                        is_analyzed: true,
                        processing_status: 'completed',
                        detected_faces: analysisResult.detected_faces || 0,
                        recognized_faces: analysisResult.recognized_students?.length || 0,
                        analyzed_at: new Date()
                    });
                }
            } else {
                // Nessuna immagine report - aggiorna solo i metadati
                await savedImage.update({
                    is_analyzed: true,
                    processing_status: 'completed',
                    detected_faces: analysisResult.detected_faces || 0,
                    recognized_faces: analysisResult.recognized_students?.length || 0,
                    analyzed_at: new Date()
                });
                console.log(`⚠️ Mantenuta immagine originale: ID ${savedImage.id}`);
            }

        } catch (analysisError) {
            console.error('❌ Errore face detection:', analysisError);
            
            // savedImage esiste sempre ora, aggiorna solo lo stato di errore
            await savedImage.update({
                is_analyzed: true,
                processing_status: 'error',
                error_message: analysisError.message
            });
        }

        // Screenshot rimosso - già salvato in LessonImage sopra per evitare duplicati

        // Genera record di presenza/assenza per tutti gli studenti
        try {
            console.log(`📊 Generazione record attendance per lezione ${lessonId} (fonte: docente)...`);
            await generateAbsenteeRecords(lesson, analysisResult.recognized_students || [], {
                source: 'teacher',
                teacher_id: req.user.id,
                teacher_name: `${req.user.name} ${req.user.surname || ''}`.trim()
            });
            console.log(`✅ Record attendance generati per lezione ${lessonId}`);
        } catch (attendanceError) {
            console.error('❌ Errore generazione record attendance:', attendanceError.message);
        }

        // Update last capture time without completing the lesson
        await lesson.update({
            last_capture_at: new Date(),
            status: lesson.status === 'draft' ? 'active' : lesson.status
        });

        // Check if lesson should be automatically completed based on end time
        let lessonCompleted = false;
        if (!lesson.is_completed && lesson.shouldBeCompleted()) {
            try {
                await lesson.markAsCompleted();
                lessonCompleted = true;
                console.log(`✅ Lezione ${lessonId} marcata come completata automaticamente (orario fine raggiunto)`);
            } catch (completionError) {
                console.warn('⚠️ Errore marcatura completamento:', completionError.message);
            }
        }

        // TEACHER DASHBOARD: Invia sempre email dopo l'analisi
        // Gli studenti devono essere notificati delle presenze rilevate dal docente
        console.log(`📧 Invio email presenze da scatto docente (ID: ${req.user.id})`);
        
        try {
            const emailService = require('../services/emailService');
            const emailResult = await emailService.sendAttendanceReportToAllStudents(lessonId, {
                source: 'teacher',
                teacher_id: req.user.id,
                teacher_name: `${req.user.name} ${req.user.surname || ''}`.trim()
            });
            
            if (emailResult.success) {
                console.log(`📧 Email presenze inviate: ${emailResult.results.sent} successi, ${emailResult.results.failed} fallimenti`);
            } else {
                console.warn('⚠️ Errore invio email presenze:', emailResult.error);
            }
        } catch (emailError) {
            console.warn('⚠️ Errore servizio email:', emailError.message);
        }

        res.json({
            success: true,
            message: 'Scatto e analisi completati. La lezione rimane in corso.',
            lesson_completed: lessonCompleted,
            image_id: savedImage.id,
            report_image_id: savedImage.id, // Stessa immagine - con riquadri se disponibili
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

router.get('/lessons/:id/images', async (req, res) => {
    try {
        const lessonId = req.params.id;
        
        const images = await LessonImage.findAll({
            where: { lesson_id: lessonId },
            attributes: [
                'id', 'source', 'captured_at', 'is_analyzed',
                'detected_faces', 'recognized_faces', 'camera_ip', 'camera_metadata'
            ],
            order: [['captured_at', 'DESC']]
        });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const imagesWithUrls = images.map(img => {
            const imageData = img.toJSON();
            return {
                ...imageData,
                url: `${baseUrl}/api/images/lesson/${img.id}`,
                thumbnail_url: `${baseUrl}/api/images/lesson/${img.id}`,
                capture_source: img.getCaptureSource(),
                captured_by: img.getCapturedBy(),
                source_label: img.getCaptureSourceLabel()
            };
        });

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


router.get('/lessons', async (req, res) => {
    try {
        const teacherId = req.user.id;
        
        const lessons = await Lesson.findAll({
            where: { teacher_id: teacherId },
            attributes: ['id', 'name', 'lesson_date', 'lesson_start', 'lesson_end', 'course_id', 'subject_id', 'classroom_id', 'teacher_id'],
            include: [
                { model: Course, as: 'course', attributes: ['id', 'name'] },
                { model: Classroom, as: 'classroom', attributes: ['id', 'name'] },
                { model: Subject, as: 'subject', attributes: ['id', 'name'], required: false }
            ],
            order: [['lesson_date', 'DESC']]
        });

        res.json({
            success: true,
            lessons
        });
    } catch (error) {
        console.error('❌ Errore caricamento lezioni:', error);
        res.status(500).json({
            success: false,
            error: 'Errore caricamento lezioni'
        });
    }
});


router.get('/courses', async (_req, res) => {
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

router.get('/classrooms', async (_req, res) => {
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

router.get('/system-status', async (_req, res) => {
    try {
        const faceDetectionStatus = await faceDetectionService.checkStatus();
        const emailStatus = await emailService.checkConfiguration();
        
        res.json({
            success: true,
            status: {
                faceDetection: faceDetectionStatus,
                camera: {
                    service: 'ready',
                    configured: true
                },
                email: emailStatus
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


router.post('/lessons/:id/send-attendance-emails', async (req, res) => {
    try {
        const lessonId = req.params.id;
        const teacherId = req.user.id;
        
        console.log(`📧 Invio email presenze per lezione ${lessonId} da teacher ${teacherId}`);
        
        const lesson = await Lesson.findOne({
            where: { 
                id: lessonId,
                teacher_id: teacherId 
            },
            include: [
                { model: Course, as: 'course', attributes: ['name'] },
                { model: Classroom, as: 'classroom', attributes: ['name'] }
            ]
        });

        if (!lesson) {
            return res.status(404).json({
                success: false,
                error: 'Lezione non trovata o non autorizzata'
            });
        }

        const analyzedImages = await LessonImage.count({
            where: { 
                lesson_id: lessonId,
                is_analyzed: true
            }
        });

        if (analyzedImages === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nessuna analisi disponibile. Esegui prima "Scatta e Analizza"'
            });
        }

        const result = await emailService.sendAttendanceReportToAllStudents(lessonId);
        
        if (result.success) {
            console.log(`✅ Email inviate per lezione ${lessonId}: ${result.results.sent} successi, ${result.results.failed} fallimenti`);
            
            res.json({
                success: true,
                message: `Email inviate con successo a ${result.results.sent} studenti`,
                details: {
                    lesson: {
                        name: lesson.name || `Lezione ${new Date(lesson.lesson_date).toLocaleDateString('it-IT')}`,
                        course: lesson.course?.name,
                        classroom: lesson.classroom?.name,
                        date: lesson.lesson_date
                    },
                    email_results: result.results
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Errore durante invio email',
                details: result.error
            });
        }

    } catch (error) {
        console.error('❌ Errore invio email presenze:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server',
            details: error.message
        });
    }
});

router.post('/lessons/:id/send-student-email/:studentId', async (req, res) => {
    try {
        const lessonId = req.params.id;
        const studentId = req.params.studentId;
        const teacherId = req.user.id;
        
        console.log(`📧 Invio email presenza studente ${studentId} per lezione ${lessonId}`);
        
        const lesson = await Lesson.findOne({
            where: { 
                id: lessonId,
                teacher_id: teacherId 
            }
        });

        if (!lesson) {
            return res.status(404).json({
                success: false,
                error: 'Lezione non trovata o non autorizzata'
            });
        }

        const result = await emailService.sendAttendanceReportToStudent(studentId, lessonId);
        
        if (result.success) {
            res.json({
                success: true,
                message: `Email inviata con successo a ${result.studentEmail}`,
                messageId: result.messageId
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Errore durante invio email',
                details: result.error
            });
        }

    } catch (error) {
        console.error('❌ Errore invio email studente:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server',
            details: error.message
        });
    }
});

/**
 * Genera record di assenza per studenti non riconosciuti nella face detection
 */
async function generateAbsenteeRecords(lesson, recognizedStudents, sourceInfo = {}) {
    try {
        const source = sourceInfo.source || 'unknown';
        const sourceLabel = source === 'teacher' ? '👨‍🏫 Docente' : '👨‍💼 Admin';
        
        console.log(`📝 Generazione record assenze per lezione ${lesson.id} (fonte: ${sourceLabel})`);
        
        // Ottieni tutti gli studenti iscritti al corso
        const enrolledStudents = await sequelize.query(`
            SELECT u.id, u.name, u.surname, u.email, u.matricola
            FROM "Users" u 
            WHERE u."courseId" = :courseId AND u.role = 'student' AND u.is_active = true
        `, {
            replacements: { courseId: lesson.course_id },
            type: sequelize.QueryTypes.SELECT
        });
        
        console.log(`👥 Studenti iscritti al corso: ${enrolledStudents.length}`);
        
        // IDs degli studenti riconosciuti 
        const recognizedIds = (recognizedStudents || []).map(s => parseInt(s.userId)).filter(id => !isNaN(id));
        console.log(`✅ Studenti riconosciuti: [${recognizedIds.join(', ')}]`);
        
        const absentStudents = [];
        
        // Crea record di presenza/assenza per tutti gli studenti
        for (const student of enrolledStudents) {
            const existingAttendance = await Attendance.findOne({
                where: {
                    userId: student.id,
                    lessonId: lesson.id
                }
            });
            
            if (!existingAttendance) {
                const isPresent = recognizedIds.includes(student.id);
                
                await Attendance.create({
                    userId: student.id,
                    lessonId: lesson.id,
                    is_present: isPresent,
                    detection_method: isPresent ? 'face_recognition' : 'manual',
                    confidence: isPresent ? 0.8 : 0.0,
                    timestamp: new Date()
                });
                
                console.log(`📋 ${isPresent ? '✅ Presente' : '❌ Assente'}: ${student.name} ${student.surname} (ID: ${student.id}) [${sourceLabel}]`);
                
                // Aggiungi studenti assenti alla lista per email
                if (!isPresent) {
                    absentStudents.push(student);
                }
            }
        }
        
        // RIMOSSO: Non inviare email qui per evitare duplicati
        // Le email vengono inviate tutte insieme dopo con sendAttendanceReportToAllStudents
        if (absentStudents.length > 0) {
            console.log(`📧 ${absentStudents.length} studenti assenti - email verranno inviate nel report finale`);
            // await sendAbsenceEmails(lesson, absentStudents); // COMMENTATO per evitare duplicati
        }
        
        console.log(`✅ Record di presenza/assenza generati per lezione ${lesson.id}`);
        
    } catch (error) {
        console.error('❌ Errore generazione record assenze:', error);
        throw error;
    }
}

/**
 * Invia email di assenza agli studenti che non sono stati riconosciuti
 */
async function sendAbsenceEmails(lesson, absentStudents) {
    try {
        console.log(`📧 Invio ${absentStudents.length} email di assenza...`);
        
        let sentCount = 0;
        let errorCount = 0;
        
        for (const student of absentStudents) {
            try {
                const emailResult = await emailService.sendAbsenceNotification(student, lesson);
                if (emailResult.success) {
                    sentCount++;
                    console.log(`✅ Email assenza inviata a ${student.email}`);
                } else {
                    errorCount++;
                    console.error(`❌ Errore invio email a ${student.email}: ${emailResult.error}`);
                }
            } catch (emailError) {
                errorCount++;
                console.error(`❌ Errore invio email a ${student.email}:`, emailError.message);
            }
        }
        
        console.log(`📧 Email assenze completate: ${sentCount} inviate, ${errorCount} errori`);
        
    } catch (error) {
        console.error('❌ Errore generale invio email assenze:', error);
    }
}

module.exports = router;