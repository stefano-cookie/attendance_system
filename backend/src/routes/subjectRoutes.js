const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const path = require('path');
const db = require(path.join(__dirname, '../models/index'));
const { sequelize } = db;
const { QueryTypes } = require('sequelize');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        console.log('GET /subjects - Recupero materie');
        
        const { courseId } = req.query;
        
        let query = `
            SELECT s.id, s.name, s.description, s.course_id,
                   c.id as "course_id", c.name as "course_name"
            FROM "Subjects" s
            LEFT JOIN "Courses" c ON s.course_id = c.id
        `;
        
        const replacements = {};
        
        if (courseId) {
            query += ` WHERE s.course_id = :courseId`;
            replacements.courseId = courseId;
        }
        
        query += ` ORDER BY s.name ASC`;
        
        const subjects = await sequelize.query(query, {
            replacements,
            type: QueryTypes.SELECT
        });
        
        const formattedSubjects = subjects.map(subject => ({
            id: subject.id,
            name: subject.name,
            description: subject.description,
            course_id: subject.course_id,
            Course: subject.course_id ? {
                id: subject.course_id,
                name: subject.course_name
            } : null
        }));
        
        console.log(`Trovate ${formattedSubjects.length} materie`);
        
        res.json(formattedSubjects);
    } catch (error) {
        console.error('Errore nel recupero delle materie:', error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [subject] = await sequelize.query(`
            SELECT s.id, s.name, s.description, s.course_id,
                   c.id as "course_id", c.name as "course_name"
            FROM "Subjects" s
            LEFT JOIN "Courses" c ON s.course_id = c.id
            WHERE s.id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });
        
        if (!subject) {
            return res.status(404).json({ message: 'Materia non trovata' });
        }
        
        const formattedSubject = {
            id: subject.id,
            name: subject.name,
            description: subject.description,
            course_id: subject.course_id,
            Course: subject.course_id ? {
                id: subject.course_id,
                name: subject.course_name
            } : null
        };
        
        res.json(formattedSubject);
    } catch (error) {
        console.error('Errore nel recupero della materia:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/', authenticate, async (req, res) => {
    try {
        const { name, description, course_id } = req.body;
        
        if (!name || !course_id) {
            return res.status(400).json({ message: 'Nome e corso sono obbligatori' });
        }
        
        const [course] = await sequelize.query(`
            SELECT id FROM "Courses" WHERE id = :course_id
        `, {
            replacements: { course_id },
            type: QueryTypes.SELECT
        });
        
        if (!course) {
            return res.status(404).json({ message: 'Corso non trovato' });
        }
        
        const [result] = await sequelize.query(`
            INSERT INTO "Subjects" (name, description, course_id, "createdAt", "updatedAt")
            VALUES (:name, :description, :course_id, NOW(), NOW())
            RETURNING id
        `, {
            replacements: { 
                name, 
                description: description || null,
                course_id
            },
            type: QueryTypes.INSERT
        });
        
        const [subject] = await sequelize.query(`
            SELECT s.id, s.name, s.description, s.course_id,
                   c.id as "course_id", c.name as "course_name"
            FROM "Subjects" s
            LEFT JOIN "Courses" c ON s.course_id = c.id
            WHERE s.id = :id
        `, {
            replacements: { id: result[0].id },
            type: QueryTypes.SELECT
        });
        
        const newSubject = {
            id: subject.id,
            name: subject.name,
            description: subject.description,
            course_id: subject.course_id,
            Course: {
                id: subject.course_id,
                name: subject.course_name
            }
        };
        
        res.status(201).json(newSubject);
    } catch (error) {
        console.error('Errore nella creazione della materia:', error);
        res.status(500).json({ message: error.message });
    }
});

router.put('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, course_id } = req.body;
        
        if (!name || !course_id) {
            return res.status(400).json({ message: 'Nome e corso sono obbligatori' });
        }
        
        const [existingSubject] = await sequelize.query(`
            SELECT id FROM "Subjects" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });
        
        if (!existingSubject) {
            return res.status(404).json({ message: 'Materia non trovata' });
        }
        
        const [course] = await sequelize.query(`
            SELECT id FROM "Courses" WHERE id = :course_id
        `, {
            replacements: { course_id },
            type: QueryTypes.SELECT
        });
        
        if (!course) {
            return res.status(404).json({ message: 'Corso non trovato' });
        }
        
        await sequelize.query(`
            UPDATE "Subjects" 
            SET name = :name, 
                description = :description, 
                course_id = :course_id, 
                "updatedAt" = NOW()
            WHERE id = :id
        `, {
            replacements: { 
                id, 
                name, 
                description: description || null,
                course_id
            },
            type: QueryTypes.UPDATE
        });
        
        const [subject] = await sequelize.query(`
            SELECT s.id, s.name, s.description, s.course_id,
                   c.id as "course_id", c.name as "course_name"
            FROM "Subjects" s
            LEFT JOIN "Courses" c ON s.course_id = c.id
            WHERE s.id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });
        
        const updatedSubject = {
            id: subject.id,
            name: subject.name,
            description: subject.description,
            course_id: subject.course_id,
            Course: {
                id: subject.course_id,
                name: subject.course_name
            }
        };
        
        res.json(updatedSubject);
    } catch (error) {
        console.error('Errore nell\'aggiornamento della materia:', error);
        res.status(500).json({ message: error.message });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [subject] = await sequelize.query(`
            SELECT id FROM "Subjects" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });
        
        if (!subject) {
            return res.status(404).json({ message: 'Materia non trovata' });
        }
        
        await sequelize.query(`
            DELETE FROM "Subjects" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.DELETE
        });
        
        res.json({ message: 'Materia eliminata con successo' });
    } catch (error) {
        console.error('Errore nell\'eliminazione della materia:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;