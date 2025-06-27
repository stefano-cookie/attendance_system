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
        const { name, description, color, years, is_active } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Il nome del corso è obbligatorio' });
        }

        console.log('📥 Creazione corso con dati:', { name, description, color, years, is_active });

        const result = await sequelize.query(`
            INSERT INTO "Courses" (name, description, color, years, is_active, "createdAt", "updatedAt")
            VALUES (:name, :description, :color, :years, :is_active, NOW(), NOW())
            RETURNING id, name, description, color, years, is_active, "createdAt", "updatedAt"
        `, {
            replacements: {
                name,
                description: description || null,
                color: color || '#3498db',
                years: years || 3,
                is_active: is_active !== undefined ? is_active : true
            },
            type: QueryTypes.INSERT
        });

        const course = result[0][0]; // QueryTypes.INSERT con RETURNING restituisce [[rows], metadata]
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
        const { name, description, color, years, is_active } = req.body;

        console.log('🔄 PUT /courses/:id chiamato');
        console.log('📥 ID corso:', id);
        console.log('📥 Body ricevuto:', req.body);

        if (!name) {
            return res.status(400).json({ message: 'Il nome del corso è obbligatorio' });
        }

        console.log('📥 Aggiornamento corso ID:', id, 'con dati:', { name, description, color, years, is_active });

        const [existingCourse] = await sequelize.query(`
            SELECT id FROM "Courses" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });

        if (!existingCourse) {
            return res.status(404).json({ message: 'Corso non trovato' });
        }

        const result = await sequelize.query(`
            UPDATE "Courses"
            SET name = :name,
                description = :description,
                color = :color,
                years = :years,
                is_active = :is_active,
                "updatedAt" = NOW()
            WHERE id = :id
            RETURNING id, name, description, color, years, is_active, "createdAt", "updatedAt"
        `, {
            replacements: {
                id,
                name,
                description: description || null,
                color: color || '#3498db',
                years: years || 3,
                is_active: is_active !== undefined ? is_active : true
            },
            type: QueryTypes.UPDATE
        });

        console.log('🔍 Risultato UPDATE raw:', result);
        console.log('🔍 Tipo risultato:', Array.isArray(result), 'Length:', result.length);
        
        // Per UPDATE con RETURNING, Sequelize restituisce [rowCount, rows]
        const updated = result[1] && result[1][0] ? result[1][0] : result[0];
        console.log('📤 Corso aggiornato:', updated);
        
        if (!updated) {
            console.error('⚠️ Nessun dato restituito dall\'UPDATE');
            return res.status(500).json({ message: 'Errore nell\'aggiornamento del corso' });
        }
        
        res.json(updated);
    } catch (error) {
        console.error('Errore aggiornamento corso:', error);
        res.status(500).json({ message: error.message });
    }
});

router.delete('/courses/:id', authenticate, async (req, res) => {
    console.log('🗑️ DELETE /courses/:id chiamato');
    console.log('📥 Parametri:', req.params);
    
    const t = await sequelize.transaction();
    
    try {
        const { id } = req.params;
        console.log('🗑️ Richiesta eliminazione corso con ID:', id);

        const [existingCourse] = await sequelize.query(`
            SELECT id FROM "Courses" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT,
            transaction: t
        });

        if (!existingCourse) {
            console.log('❌ Corso non trovato con ID:', id);
            await t.rollback();
            return res.status(404).json({ message: 'Corso non trovato' });
        }

        console.log('📋 Corso trovato:', existingCourse);

        // Prima aggiorna tutti gli utenti che hanno questo courseId
        const updateUsersResult = await sequelize.query(`
            UPDATE "Users" SET "courseId" = NULL WHERE "courseId" = :id
        `, {
            replacements: { id },
            type: QueryTypes.UPDATE,
            transaction: t
        });

        console.log('👥 Utenti aggiornati:', updateUsersResult);

        // Verifica quanti utenti sono stati aggiornati
        const [affectedUsers] = await sequelize.query(`
            SELECT COUNT(*) as count FROM "Users" WHERE "courseId" = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT,
            transaction: t
        });
        console.log('👥 Utenti ancora con courseId:', affectedUsers);

        // Poi elimina il corso (le materie vengono già gestite con SET NULL, le lezioni con CASCADE)
        const result = await sequelize.query(`
            DELETE FROM "Courses" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.DELETE,
            transaction: t
        });

        console.log('✅ Risultato eliminazione:', result);

        // Verifica che il corso sia stato effettivamente eliminato
        const [checkDeleted] = await sequelize.query(`
            SELECT id FROM "Courses" WHERE id = :id
        `, {
            replacements: { id },
            type: QueryTypes.SELECT,
            transaction: t
        });

        if (checkDeleted) {
            console.error('⚠️ ATTENZIONE: Il corso non è stato eliminato dal database!');
            await t.rollback();
            return res.status(500).json({ message: 'Errore nell\'eliminazione del corso dal database' });
        }

        await t.commit();
        console.log('✅ Corso eliminato con successo dal database');
        res.json({ message: 'Corso eliminato con successo' });
    } catch (error) {
        await t.rollback();
        console.error('❌ Errore eliminazione corso:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;