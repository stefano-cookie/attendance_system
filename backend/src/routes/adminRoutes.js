const express = require('express');
const { User, Course, Subject, Lesson, Attendance } = require('../models');
const { authenticate } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

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
            SELECT li.id, li.lesson_id, li.captured_at, 
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
        
        const formattedScreenshots = lessonImages.map(image => {
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

module.exports = router;