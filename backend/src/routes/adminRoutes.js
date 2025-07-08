const express = require('express');
const { User, Course, Subject, Lesson, Attendance, LessonImage, Screenshot, Classroom } = require('../models');
const { authenticate } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

const enhancedCameraService = require('../services/enhancedCameraService');
const faceDetectionService = require('../services/faceDetectionService');

const router = express.Router();

router.get('/stats', authenticate, isAdmin, async (req, res) => {
    try {        
        const totalStudents = await User.count({ 
            where: { role: 'student' } 
        });
        
        const totalCourses = await Course.count();
        const totalSubjects = await Subject.count();
        const totalLessons = await Lesson.count();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayAttendance = await Attendance.count({
            where: {
                createdAt: {
                    [Op.gte]: today,
                    [Op.lt]: tomorrow
                }
            }
        });

        const stats = {
            totalStudents,
            totalCourses,
            totalSubjects, 
            totalLessons,
            todayAttendance,
            attendanceRate: totalStudents > 0 ? ((todayAttendance / totalStudents) * 100).toFixed(1) : 0,
            recentAttendance: []
        };
        
        res.json(stats);
        
    } catch (error) {
        console.error('❌ Errore caricamento statistiche:', error);
        res.status(500).json({ 
            message: 'Errore caricamento statistiche',
            error: error.message 
        });
    }
});

router.get('/students', authenticate, isAdmin, async (req, res) => {
    try {
        const students = await User.findAll({
            where: { role: 'student' },
            include: [
                {
                    model: Course,
                    attributes: ['name']
                }
            ],
            order: [['name', 'ASC']]
        });

        res.json(students);
    } catch (error) {
        console.error('Errore caricamento studenti:', error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/screenshots', authenticate, isAdmin, async (req, res) => {
    try {
        console.log('GET /api/admin/screenshots - Recupero LessonImages');
        const { lessonId, startDate, endDate, include } = req.query;
        
        const includeRelations = include ? include.split(',') : [];
        const includeLesson = includeRelations.includes('lesson');
        const includeClassroom = includeRelations.includes('classroom');
        
        let query = `
            SELECT DISTINCT li.id, li.lesson_id, li.captured_at, 
                   li.detected_faces, li.source, li.mime_type, 
                   li.file_size, li.original_filename, li.camera_ip,
                   li.is_analyzed, li.analysis_metadata,
                   CASE WHEN li.image_data IS NOT NULL THEN true ELSE false END as "hasImageData"
        `;
        
        if (includeLesson) {
            query += `, 
                l.id as lesson_table_id, l.name as lesson_name, l.lesson_date as lesson_date
            `;
        }
        
        if (includeClassroom && includeLesson) {
            query += `, 
                c.id as classroom_id, c.name as classroom_name
            `;
        }
        
        query += ` FROM "LessonImages" li`;
        
        if (includeLesson) {
            query += ` LEFT JOIN "Lessons" l ON li.lesson_id = l.id`;
        }
        
        if (includeClassroom && includeLesson) {
            query += ` LEFT JOIN "Classrooms" c ON l.classroom_id = c.id`;
        }
        
        query += ` WHERE 1=1`;
        
        const replacements = {};
        
        if (lessonId) {
            query += ` AND li.lesson_id = :lessonId`;
            replacements.lessonId = lessonId;
        }
        
        if (startDate && endDate) {
            query += ` AND li.captured_at BETWEEN :startDate AND :endDate`;
            replacements.startDate = startDate;
            replacements.endDate = endDate;
        }
        
        query += ` ORDER BY li.captured_at DESC`;
        
        console.log('Query SQL Admin LessonImages:', query);
        console.log('Replacements:', replacements);
        
        const lessonImages = await sequelize.query(query, {
            replacements,
            type: sequelize.QueryTypes.SELECT
        });
        
        console.log(`✅ Admin: Trovate ${lessonImages.length} LessonImages`);
        
        // Rimuovi eventuali duplicati basati su ID (sicurezza aggiuntiva)
        const uniqueLessonImages = lessonImages.filter((image, index, arr) => 
            arr.findIndex(i => i.id === image.id) === index
        );
        
        if (uniqueLessonImages.length !== lessonImages.length) {
            console.warn(`⚠️ Rimossi ${lessonImages.length - uniqueLessonImages.length} duplicati dal risultato SQL`);
        }
        
        const formattedScreenshots = uniqueLessonImages.map(image => {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            
            const result = {
                id: image.id,
                path: null,
                lessonId: image.lesson_id,
                timestamp: image.captured_at,
                detectedFaces: image.detected_faces || 0,
                source: image.source || 'camera',
                mimeType: image.mime_type || 'image/jpeg',
                fileSize: image.file_size,
                originalFilename: image.original_filename,
                cameraIp: image.camera_ip,
                isAnalyzed: image.is_analyzed,
                analysisMetadata: image.analysis_metadata,
                hasImageData: image.hasImageData,
                url: `${baseUrl}/api/images/lesson/${image.id}`,
                downloadUrl: `${baseUrl}/api/images/download/lesson/${image.id}`
            };
            
            if (includeLesson && image.lesson_table_id) {
                result.lesson = {
                    id: image.lesson_table_id,
                    name: image.lesson_name,
                    date: image.lesson_date
                };
            }
            
            if (includeClassroom && image.classroom_id) {
                result.classroom = {
                    id: image.classroom_id,
                    name: image.classroom_name
                };
            }
            
            return result;
        });
        
        res.json({ screenshots: formattedScreenshots });
        
    } catch (error) {
        console.error('❌ Errore admin LessonImages:', error);
        res.status(500).json({ 
            message: 'Errore nel recupero delle immagini lezioni per admin',
            error: error.message,
            stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
        });
    }
});

router.get('/lesson-image/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [lessonImage] = await sequelize.query(`
            SELECT li.id, li.lesson_id, li.captured_at, li.detected_faces,
                   li.source, li.mime_type, li.file_size, li.original_filename,
                   li.camera_ip, li.is_analyzed, li.analysis_metadata,
                   CASE WHEN li.image_data IS NOT NULL THEN true ELSE false END as "hasImageData",
                   l.id as lesson_table_id, l.name as lesson_name, l.lesson_date,
                   c.id as classroom_id, c.name as classroom_name
            FROM "LessonImages" li
            LEFT JOIN "Lessons" l ON li.lesson_id = l.id
            LEFT JOIN "Classrooms" c ON l.classroom_id = c.id
            WHERE li.id = :id
        `, {
            replacements: { id },
            type: sequelize.QueryTypes.SELECT
        });
        
        if (!lessonImage) {
            return res.status(404).json({ message: 'Immagine lezione non trovata' });
        }
        
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        const formattedImage = {
            id: lessonImage.id,
            lessonId: lessonImage.lesson_id,
            timestamp: lessonImage.captured_at,
            detectedFaces: lessonImage.detected_faces || 0,
            source: lessonImage.source || 'camera',
            mimeType: lessonImage.mime_type || 'image/jpeg',
            fileSize: lessonImage.file_size,
            originalFilename: lessonImage.original_filename,
            cameraIp: lessonImage.camera_ip,
            isAnalyzed: lessonImage.is_analyzed,
            analysisMetadata: lessonImage.analysis_metadata,
            hasImageData: lessonImage.hasImageData,
            url: `${baseUrl}/api/images/lesson/${lessonImage.id}`,
            downloadUrl: `${baseUrl}/api/images/download/lesson/${lessonImage.id}`,
            lesson: lessonImage.lesson_table_id ? {
                id: lessonImage.lesson_table_id,
                name: lessonImage.lesson_name,
                date: lessonImage.lesson_date
            } : null,
            classroom: lessonImage.classroom_id ? {
                id: lessonImage.classroom_id,
                name: lessonImage.classroom_name
            } : null
        };
        
        res.json(formattedImage);
    } catch (error) {
        console.error('Errore nel recupero dell\'immagine lezione:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/lessons/:id/capture-and-analyze', authenticate, isAdmin, async (req, res) => {
    try {
        const lessonId = req.params.id;
        
        console.log(`\n📸 ADMIN CAPTURE AND ANALYZE per lezione ${lessonId}`);
        
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
                capture_source: 'admin',
                admin_id: req.user.id,
                admin_name: `${req.user.name} ${req.user.surname || ''}`.trim(),
                admin_email: req.user.email,
                captured_by_role: 'admin',
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

        // Screenshot salvato già in LessonImage sopra - rimuovo duplicato

        // Update last capture time without completing the lesson
        await lesson.update({
            last_capture_at: new Date(),
            status: lesson.status === 'draft' ? 'active' : lesson.status
        });

        let lessonCompleted = false;
        // Check if lesson should be automatically completed based on end time
        if (!lesson.is_completed && lesson.shouldBeCompleted()) {
            try {
                await lesson.markAsCompleted();
                lessonCompleted = true;
                console.log(`✅ Lezione ${lessonId} marcata come completata automaticamente (orario fine raggiunto)`);
            } catch (completionError) {
                console.warn('⚠️ Errore marcatura completamento:', completionError.message);
            }
        }

        console.log(`📊 Generazione report per controllo amministrativo (senza email)`);
        
        try {
            const emailService = require('../services/emailService');
            const reportResult = await emailService.generateAttendanceReport(lessonId);
            if (reportResult.success) {
                console.log(`📋 Report generato per revisione admin: ${reportResult.summary.presentStudents} presenti, ${reportResult.summary.absentStudents} assenti`);
            }
        } catch (reportError) {
            console.warn('⚠️ Errore generazione report:', reportError.message);
        }

        res.json({
            success: true,
            message: 'Scatto e analisi completati',
            lesson_completed: lessonCompleted,
            image_id: savedImage.id,
            report_image_id: savedImage.id,
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
        console.error('❌ ERRORE admin capture-and-analyze:', error);
        
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'Errore interno del server',
                details: error.message
            });
        }
    }
});

module.exports = router;