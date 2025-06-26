const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const path = require('path');
const db = require(path.join(__dirname, '../models/index'));
const { sequelize } = db;
const { QueryTypes } = require('sequelize');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        console.log('GET /attendance - Inizio elaborazione');
        const { startDate, endDate, userId, lessonId, courseId } = req.query;
        
        let sqlQuery = `
            SELECT 
                a.id,
                a."userId",
                a."lessonId", 
                a.is_present,
                a.timestamp,
                a.confidence,
                a."imageFile",
                a."screenshotId",
                -- Dati studente
                u.id as student_id,
                u.name as student_name,
                u.surname as student_surname,
                u.email as student_email,
                u.matricola as student_matricola,
                u."courseId" as student_courseId,
                -- Dati lezione
                l.id as lesson_id,
                l.name as lesson_name,
                l.lesson_date as lesson_date,
                l.course_id as lesson_courseId,
                -- Dati corso
                c.id as course_id,
                c.name as course_name,
                -- Dati materia
                s.id as subject_id,
                s.name as subject_name
            FROM "Attendances" a
            LEFT JOIN "Users" u ON a."userId" = u.id
            LEFT JOIN "Lessons" l ON a."lessonId" = l.id
            LEFT JOIN "Courses" c ON l.course_id = c.id
            LEFT JOIN "Subjects" s ON l.subject_id = s.id
            WHERE 1=1
        `;
        
        const replacements = {};
        
        if (startDate && endDate) {
            sqlQuery += ` AND a.timestamp BETWEEN :startDate AND :endDate`;
            replacements.startDate = new Date(startDate);
            replacements.endDate = new Date(endDate);
        }
        
        if (userId) {
            sqlQuery += ` AND a."userId" = :userId`;
            replacements.userId = userId;
        }
        
        if (lessonId) {
            sqlQuery += ` AND a."lessonId" = :lessonId`;
            replacements.lessonId = lessonId;
        }
        
        sqlQuery += ` ORDER BY a.timestamp DESC`;
        
        console.log('Query SQL:', sqlQuery);
        console.log('Replacements:', replacements);
        
        const attendances = await sequelize.query(sqlQuery, {
            replacements,
            type: QueryTypes.SELECT
        });
        
        console.log(`Trovate ${attendances.length} presenze`);
        
        const formattedAttendances = attendances.map(record => {
            return {
                id: record.id,
                userId: record.userId,
                lessonId: record.lessonId,
                is_present: record.is_present,
                timestamp: record.timestamp,
                confidence: record.confidence || 0,
                imageFile: record.imageFile,
                screenshotId: record.screenshotId,
                student: record.student_id ? {
                    id: record.student_id,
                    name: record.student_name,
                    surname: record.student_surname,
                    email: record.student_email,
                    matricola: record.student_matricola,
                    courseId: record.student_courseId
                } : null,
                lesson: record.lesson_id ? {
                    id: record.lesson_id,
                    name: record.lesson_name,
                    lesson_date: record.lesson_date,
                    course: record.course_id ? {
                        id: record.course_id,
                        name: record.course_name
                    } : null,
                    subject: record.subject_id ? {
                        id: record.subject_id,
                        name: record.subject_name
                    } : null
                } : null
            };
        });
        
        res.json({ attendances: formattedAttendances });
    } catch (error) {
        console.error('Errore nel recupero delle presenze:', error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/debug', authenticate, async (req, res) => {
    try {
        console.log('GET /attendance/debug - Test connessione database');
        
        const userColumns = await sequelize.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'Users'
            ORDER BY ordinal_position
        `, {
            type: QueryTypes.SELECT
        });
        
        const attendanceColumns = await sequelize.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'Attendances'
            ORDER BY ordinal_position
        `, {
            type: QueryTypes.SELECT
        });
        
        const attendanceCount = await sequelize.query('SELECT COUNT(*) as count FROM "Attendances"', {
            type: QueryTypes.SELECT
        });
        
        const userCount = await sequelize.query('SELECT COUNT(*) as count FROM "Users" WHERE role = \'student\'', {
            type: QueryTypes.SELECT
        });
        
        console.log('Struttura tabella Users:', userColumns);
        console.log('Struttura tabella Attendances:', attendanceColumns);
        
        res.json({
            dbConnected: true,
            attendanceCount: attendanceCount[0]?.count || 0,
            studentsCount: userCount[0]?.count || 0,
            userColumns: userColumns,
            attendanceColumns: attendanceColumns,
            message: 'Informazioni di debug sulle strutture del database'
        });
    } catch (error) {
        console.error('Errore test database:', error);
        res.status(500).json({ 
            dbConnected: false,
            message: error.message 
        });
    }
});

router.post('/', authenticate, async (req, res) => {
    try {
        console.log('POST /attendance - Creazione presenza');
        const { userId, lessonId, is_present, timestamp } = req.body;
        
        if (!userId || !lessonId) {
            return res.status(400).json({ message: 'userId e lessonId sono obbligatori' });
        }
        
        const [students] = await sequelize.query(
            'SELECT * FROM "Users" WHERE id = :userId AND role = \'student\'',
            {
                replacements: { userId },
                type: QueryTypes.SELECT
            }
        );
        
        if (!students || students.length === 0) {
            return res.status(404).json({ message: 'Studente non trovato' });
        }
        
        const [result] = await sequelize.query(`
            INSERT INTO "Attendances" ("userId", "lessonId", "is_present", "timestamp", "createdAt", "updatedAt")
            VALUES (:userId, :lessonId, :is_present, :timestamp, NOW(), NOW())
            RETURNING *
        `, {
            replacements: {
                userId,
                lessonId,
                is_present: is_present !== undefined ? is_present : true,
                timestamp: timestamp || new Date()
            },
            type: QueryTypes.INSERT
        });
        
        console.log('Record presenza creato:', result);
        
        res.status(201).json({ 
            id: result[0]?.id,
            userId,
            lessonId,
            is_present: is_present !== undefined ? is_present : true,
            timestamp: timestamp || new Date(),
            message: 'Presenza creata con successo'
        });
    } catch (error) {
        console.error('Errore nella creazione della presenza:', error);
        res.status(500).json({ message: error.message });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        console.log(`DELETE /attendance/${req.params.id}`);
        const id = req.params.id;
        
        const [attendance] = await sequelize.query(
            'SELECT id FROM "Attendances" WHERE id = :id',
            {
                replacements: { id },
                type: QueryTypes.SELECT
            }
        );
        
        if (!attendance) {
            return res.status(404).json({ message: 'Presenza non trovata' });
        }
        
        await sequelize.query(
            'DELETE FROM "Attendances" WHERE id = :id',
            {
                replacements: { id },
                type: QueryTypes.DELETE
            }
        );
        
        console.log(`Presenza ${id} eliminata con successo`);
        
        res.json({ message: 'Presenza eliminata con successo' });
    } catch (error) {
        console.error('Errore nell\'eliminazione della presenza:', error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/lesson/:lessonId/complete', authenticate, async (req, res) => {
    try {
        const { lessonId } = req.params;
        console.log(`GET /attendance/lesson/${lessonId}/complete - Recupero presenze complete`);
        
        const [lessonInfo] = await sequelize.query(`
            SELECT l.id, l.name as lesson_name, l.lesson_date, l.course_id,
                   c.name as course_name,
                   s.name as subject_name
            FROM "Lessons" l
            LEFT JOIN "Courses" c ON l.course_id = c.id
            LEFT JOIN "Subjects" s ON l.subject_id = s.id
            WHERE l.id = :lessonId
        `, {
            replacements: { lessonId },
            type: QueryTypes.SELECT
        });
        
        if (!lessonInfo) {
            return res.status(404).json({ message: 'Lezione non trovata' });
        }
        
        const students = await sequelize.query(`
            SELECT u.id, u.name, u.surname, u.email, u.matricola,
                   a.id as attendance_id,
                   a.is_present,
                   a.timestamp,
                   a.confidence,
                   a."screenshotId"
            FROM "Users" u
            LEFT JOIN "Attendances" a ON u.id = a."userId" AND a."lessonId" = :lessonId
            WHERE u."courseId" = :courseId AND u.role = 'student'
            ORDER BY u.surname, u.name
        `, {
            replacements: { 
                lessonId: lessonInfo.id,
                courseId: lessonInfo.course_id 
            },
            type: QueryTypes.SELECT
        });
        
        const formattedAttendances = students.map(student => ({
            id: student.attendance_id || null,
            userId: student.id,
            lessonId: parseInt(lessonId),
            is_present: student.is_present !== null ? student.is_present : false,
            timestamp: student.timestamp || null,
            confidence: student.confidence || 0,
            screenshotId: student.screenshotId || null,
            student: {
                id: student.id,
                name: student.name,
                surname: student.surname,
                email: student.email,
                matricola: student.matricola
            },
            lesson: {
                id: lessonInfo.id,
                name: lessonInfo.lesson_name,
                lesson_date: lessonInfo.lesson_date,
                course: {
                    id: lessonInfo.course_id,
                    name: lessonInfo.course_name
                },
                subject: {
                    name: lessonInfo.subject_name
                }
            }
        }));
        
        const totalStudents = students.length;
        const presentStudents = students.filter(s => s.is_present === true).length;
        const absentStudents = totalStudents - presentStudents;
        const attendanceRate = totalStudents > 0 ? (presentStudents / totalStudents * 100) : 0;
        
        res.json({
            lessonInfo,
            attendances: formattedAttendances,
            stats: {
                totalStudents,
                presentStudents,
                absentStudents,
                attendanceRate: attendanceRate.toFixed(1)
            }
        });
        
    } catch (error) {
        console.error('Errore nel recupero delle presenze complete:', error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/course/:courseId/complete', authenticate, async (req, res) => {
    try {
        const { courseId } = req.params;
        const { startDate, endDate } = req.query;
        
        console.log(`GET /attendance/course/${courseId}/complete`);
        
        let dateFilter = '';
        const replacements = { courseId };
        
        if (startDate && endDate) {
            dateFilter = 'AND l.lesson_date BETWEEN :startDate AND :endDate';
            replacements.startDate = startDate;
            replacements.endDate = endDate;
        }
        
        const attendanceData = await sequelize.query(`
            SELECT 
                u.id as student_id,
                u.name as student_name,
                u.surname as student_surname,
                u.matricola,
                u.email,
                l.id as lesson_id,
                l.name as lesson_name,
                l.lesson_date,
                s.name as subject_name,
                a.id as attendance_id,
                a.is_present,
                a.timestamp,
                a.confidence
            FROM "Users" u
            CROSS JOIN "Lessons" l
            LEFT JOIN "Subjects" s ON l.subject_id = s.id
            LEFT JOIN "Attendances" a ON u.id = a."userId" AND l.id = a."lessonId"
            WHERE u."courseId" = :courseId 
                AND u.role = 'student'
                AND l.course_id = :courseId
                ${dateFilter}
            ORDER BY l.lesson_date DESC, u.surname, u.name
        `, {
            replacements,
            type: QueryTypes.SELECT
        });
        
        const attendancesByLesson = {};
        
        attendanceData.forEach(record => {
            const lessonKey = record.lesson_id;
            
            if (!attendancesByLesson[lessonKey]) {
                attendancesByLesson[lessonKey] = {
                    lesson: {
                        id: record.lesson_id,
                        name: record.lesson_name,
                        date: record.lesson_date,
                        subject: record.subject_name
                    },
                    students: []
                };
            }
            
            attendancesByLesson[lessonKey].students.push({
                id: record.student_id,
                name: record.student_name,
                surname: record.student_surname,
                matricola: record.matricola,
                email: record.email,
                is_present: record.is_present !== null ? record.is_present : false,
                timestamp: record.timestamp,
                confidence: record.confidence || 0
            });
        });
        
        res.json({
            courseId,
            attendancesByLesson: Object.values(attendancesByLesson)
        });
        
    } catch (error) {
        console.error('Errore nel recupero delle presenze complete del corso:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;