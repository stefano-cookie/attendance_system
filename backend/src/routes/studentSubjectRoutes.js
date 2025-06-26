const express = require('express');
const { StudentSubject } = require('../models/StudentSubject');
const { User, Course } = require('../models/User');
const { Subject } = require('../models/Subject');
const { authenticate } = require('../middleware/authMiddleware');
const { isTechnician } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        const { studentId, subjectId, passed } = req.query;
        const where = {};
        
        if (studentId) where.student_id = studentId;
        if (subjectId) where.subject_id = subjectId;
        if (passed !== undefined) where.passed = passed === 'true';
        
        const studentSubjects = await StudentSubject.findAll({
            where,
            include: [
                { model: User, attributes: ['name', 'surname', 'email'] },
                { 
                    model: Subject, 
                    attributes: ['name'], 
                    include: [{ model: Course, attributes: ['name'] }] 
                }
            ]
        });
        
        res.json(studentSubjects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', authenticate, isTechnician, async (req, res) => {
    try {
        const { student_id, subject_id, passed, passed_date } = req.body;
        
        if (!student_id || !subject_id) {
            return res.status(400).json({ message: 'Studente e materia sono obbligatori' });
        }
        
        const existing = await StudentSubject.findOne({
            where: { student_id, subject_id }
        });
        
        if (existing) {
            return res.status(400).json({ 
                message: 'Esiste già una relazione tra questo studente e questa materia' 
            });
        }
        
        const studentSubject = await StudentSubject.create({
            student_id,
            subject_id,
            passed: passed || false,
            passed_date: passed_date ? new Date(passed_date) : null
        });
        
        res.status(201).json(studentSubject);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', authenticate, isTechnician, async (req, res) => {
    try {
        const { passed, passed_date } = req.body;
        const studentSubject = await StudentSubject.findByPk(req.params.id);
        
        if (!studentSubject) {
            return res.status(404).json({ message: 'Relazione non trovata' });
        }
        
        await studentSubject.update({
            passed: passed !== undefined ? passed : studentSubject.passed,
            passed_date: passed_date ? new Date(passed_date) : studentSubject.passed_date
        });
        
        res.json(studentSubject);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', authenticate, isTechnician, async (req, res) => {
    try {
        const studentSubject = await StudentSubject.findByPk(req.params.id);
        
        if (!studentSubject) {
            return res.status(404).json({ message: 'Relazione non trovata' });
        }
        
        await studentSubject.destroy();
        res.json({ message: 'Relazione eliminata con successo' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;