const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { Classroom } = require('../models');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        console.log('🏫 GET /classrooms - Recupero aule con Sequelize');
        
        const classrooms = await Classroom.findAll({
            attributes: [
                'id', 'name', 'capacity', 'camera_ip', 'camera_status', 
                'camera_model', 'is_active', 'createdAt', 'updatedAt'
            ],
            order: [['name', 'ASC']]
        });
        
        console.log(`✅ Trovate ${classrooms.length} aule`);
        
        const formattedClassrooms = classrooms.map(classroom => ({
            id: classroom.id,
            name: classroom.name,
            capacity: classroom.capacity,
            camera_id: classroom.camera_ip,
            camera_ip: classroom.camera_ip,
            camera_status: classroom.camera_status || 'unknown',
            camera_model: classroom.camera_model,
            hasCamera: !!classroom.camera_ip,
            is_active: classroom.is_active !== false,
            createdAt: classroom.createdAt,
            updatedAt: classroom.updatedAt
        }));
        
        res.json({
            success: true,
            data: formattedClassrooms,
            total: formattedClassrooms.length
        });
    } catch (error) {
        console.error('❌ Errore nel recupero delle aule:', error);
        res.status(500).json({ 
            success: false,
            message: 'Errore nel recupero delle aule',
            error: error.message 
        });
    }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        const classroom = await Classroom.findByPk(id, {
            attributes: [
                'id', 'name', 'capacity', 'camera_ip', 'camera_status', 
                'camera_model', 'is_active', 'createdAt', 'updatedAt'
            ]
        });
        
        if (!classroom) {
            return res.status(404).json({ 
                success: false,
                message: 'Aula non trovata' 
            });
        }
        
        const formattedClassroom = {
            id: classroom.id,
            name: classroom.name,
            capacity: classroom.capacity,
            camera_id: classroom.camera_ip,
            camera_ip: classroom.camera_ip,
            camera_status: classroom.camera_status || 'unknown',
            camera_model: classroom.camera_model,
            hasCamera: !!classroom.camera_ip,
            is_active: classroom.is_active !== false,
            createdAt: classroom.createdAt,
            updatedAt: classroom.updatedAt
        };
        
        res.json({
            success: true,
            data: formattedClassroom
        });
    } catch (error) {
        console.error('❌ Errore nel recupero dell\'aula:', error);
        res.status(500).json({ 
            success: false,
            message: 'Errore nel recupero dell\'aula',
            error: error.message 
        });
    }
});

router.post('/', authenticate, async (req, res) => {
    try {
        const { name, capacity, camera_ip } = req.body;
        
        if (!name) {
            return res.status(400).json({ 
                success: false,
                message: 'Il nome dell\'aula è obbligatorio' 
            });
        }
        
        const classroom = await Classroom.create({
            name,
            capacity: capacity || null,
            camera_ip: camera_ip || null,
            is_active: true
        });
        
        const formattedClassroom = {
            id: classroom.id,
            name: classroom.name,
            capacity: classroom.capacity,
            camera_id: classroom.camera_ip,
            camera_ip: classroom.camera_ip,
            camera_status: 'unknown',
            hasCamera: !!classroom.camera_ip,
            is_active: true,
            createdAt: classroom.createdAt,
            updatedAt: classroom.updatedAt
        };
        
        res.status(201).json({
            success: true,
            data: formattedClassroom,
            message: 'Aula creata con successo'
        });
    } catch (error) {
        console.error('❌ Errore nella creazione dell\'aula:', error);
        res.status(500).json({ 
            success: false,
            message: 'Errore nella creazione dell\'aula',
            error: error.message 
        });
    }
});

router.put('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, capacity, camera_ip } = req.body;
        
        if (!name) {
            return res.status(400).json({ 
                success: false,
                message: 'Il nome dell\'aula è obbligatorio' 
            });
        }
        
        const classroom = await Classroom.findByPk(id);
        
        if (!classroom) {
            return res.status(404).json({ 
                success: false,
                message: 'Aula non trovata' 
            });
        }
        
        await classroom.update({
            name,
            capacity: capacity || null,
            camera_ip: camera_ip || null
        });
        
        const formattedClassroom = {
            id: classroom.id,
            name: classroom.name,
            capacity: classroom.capacity,
            camera_id: classroom.camera_ip,
            camera_ip: classroom.camera_ip,
            camera_status: classroom.camera_status || 'unknown',
            hasCamera: !!classroom.camera_ip,
            is_active: classroom.is_active !== false,
            createdAt: classroom.createdAt,
            updatedAt: classroom.updatedAt
        };
        
        res.json({
            success: true,
            data: formattedClassroom,
            message: 'Aula aggiornata con successo'
        });
    } catch (error) {
        console.error('❌ Errore nell\'aggiornamento dell\'aula:', error);
        res.status(500).json({ 
            success: false,
            message: 'Errore nell\'aggiornamento dell\'aula',
            error: error.message 
        });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        const classroom = await Classroom.findByPk(id);
        
        if (!classroom) {
            return res.status(404).json({ 
                success: false,
                message: 'Aula non trovata' 
            });
        }
        
        await classroom.destroy();
        
        res.json({ 
            success: true,
            message: 'Aula eliminata con successo' 
        });
    } catch (error) {
        console.error('❌ Errore nell\'eliminazione dell\'aula:', error);
        res.status(500).json({ 
            success: false,
            message: 'Errore nell\'eliminazione dell\'aula',
            error: error.message 
        });
    }
});

module.exports = router;