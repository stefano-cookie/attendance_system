const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const path = require('path');
const db = require(path.join(__dirname, '../models/index'));
const { sequelize } = db;
const { QueryTypes } = require('sequelize');

const router = express.Router();

router.get('/courses', authenticate, async (req, res) => {
    try {
        const courses = await sequelize.query(`
            SELECT id, name, description, color, "createdAt", "updatedAt"
            FROM "Courses"
            ORDER BY name ASC
        `, {
            type: QueryTypes.SELECT
        });
        
        console.log('📊 Corsi recuperati:', courses.length);
        console.log('🎨 Corsi con colore:', courses.filter(c => c.color).length);
        
        res.json({ courses });
    } catch (error) {
        console.error('Errore nel recupero dei corsi:', error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/courses/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const [course] = await sequelize.query(`
            SELECT id, name, description, color, "createdAt", "updatedAt"
            FROM "Courses"
            WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });

        if (!course) {
            return res.status(404).json({ message: 'Corso non trovato' });
        }

        res.json(course);
    } catch (error) {
        console.error('Errore nel recupero del corso:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/courses', authenticate, async (req, res) => {
    try {
        const { name, description, color } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Il nome del corso è obbligatorio' });
        }

        console.log('📥 Creazione corso con dati:', { name, description, color });

        const [course] = await sequelize.query(`
            INSERT INTO "Courses" (name, description, color, "createdAt", "updatedAt")
            VALUES (:name, :description, :color, NOW(), NOW())
            RETURNING id, name, description, color, "createdAt", "updatedAt"
        `, {
            replacements: {
                name,
                description: description || null,
                color: color || '#3498db'
            },
            type: QueryTypes.INSERT
        });

        console.log('📤 Corso creato:', course);
        res.status(201).json(course);
    } catch (error) {
        console.error('Errore nella creazione del corso:', error);
        res.status(500).json({ message: error.message });
    }
});

router.put('/courses/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, color } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Il nome del corso è obbligatorio' });
        }

        console.log('📥 Aggiornamento corso ID:', id, 'con dati:', { name, description, color });

        const [existingCourse] = await sequelize.query(`
            SELECT id FROM "Courses" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });

        if (!existingCourse) {
            return res.status(404).json({ message: 'Corso non trovato' });
        }

        const [updated] = await sequelize.query(`
            UPDATE "Courses"
            SET name = :name,
                description = :description,
                color = :color,
                "updatedAt" = NOW()
            WHERE id = :id
            RETURNING id, name, description, color, "createdAt", "updatedAt"
        `, {
            replacements: {
                id,
                name,
                description: description || null,
                color: color || '#3498db'
            },
            type: QueryTypes.UPDATE
        });

        console.log('📤 Corso aggiornato:', updated);
        res.json(updated);
    } catch (error) {
        console.error('Errore aggiornamento corso:', error);
        res.status(500).json({ message: error.message });
    }
});

router.delete('/courses/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const [existingCourse] = await sequelize.query(`
            SELECT id FROM "Courses" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });

        if (!existingCourse) {
            return res.status(404).json({ message: 'Corso non trovato' });
        }

        await sequelize.query(`
            DELETE FROM "Courses" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.DELETE
        });

        res.json({ message: 'Corso eliminato con successo' });
    } catch (error) {
        console.error('Errore eliminazione corso:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;