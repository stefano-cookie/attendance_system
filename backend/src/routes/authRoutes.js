const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, UserToken, Course } = require('../models');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔐 Tentativo di login per:', email);
        
        const user = await User.findOne({ 
            where: { email },
            include: [{
                model: Course,
                as: 'course',
                attributes: ['id', 'name', 'code']
            }]
        });
        
        if (!user) {
            console.log('❌ Utente non trovato:', email);
            return res.status(401).json({ 
                success: false, 
                message: 'Credenziali non valide' 
            });
        }
        
        console.log('👤 Utente trovato:', {
            id: user.id,
            email: user.email,
            role: user.role,
            hasPassword: !!user.password
        });
        
        if (!user.password) {
            console.log('❌ Utente senza password:', email);
            return res.status(401).json({ 
                success: false, 
                message: 'Account non configurato correttamente' 
            });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            console.log('❌ Password non valida per:', email);
            return res.status(401).json({ 
                success: false, 
                message: 'Credenziali non valide' 
            });
        }
        
        const token = jwt.sign(
            { 
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET || 'jwtmannoli2025',
            { expiresIn: '7d' }
        );
        
        try {
            await UserToken.create({
                userId: user.id,
                token: token
            });
        } catch (tokenError) {
            console.error('⚠️ Errore salvataggio token (non critico):', tokenError.message);
        }
        
        const userData = {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            role: user.role,
            matricola: user.matricola,
            course: user.course,
            photoPath: user.photoPath ? `/api/users/${user.id}/photo` : null,
            is_active: user.is_active
        };
        
        console.log('✅ Login riuscito per:', email);
        
        res.status(200).json({ 
            success: true, 
            user: userData, 
            token 
        });
        
    } catch (error) {
        console.error('❌ Errore login:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Errore durante il login',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        console.log('🔍 Get current user per ID:', req.user.id);
        
        const user = await User.findByPk(req.user.id, {
            attributes: [
                'id', 'email', 'name', 'surname', 'role', 
                'matricola', 'photoPath', 'is_active', 'courseId'
            ],
            include: [{
                model: Course,
                as: 'course',
                attributes: ['id', 'name', 'code']
            }]
        });
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'Utente non trovato' 
            });
        }
        
        const userData = {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            role: user.role,
            matricola: user.matricola,
            course: user.course,
            photoPath: user.photoPath ? `/api/users/${user.id}/photo` : null,
            is_active: user.is_active
        };
        
        console.log('✅ Current user trovato:', user.email);
        
        res.json({ 
            success: true,
            user: userData 
        });
        
    } catch (error) {
        console.error('❌ Errore get current user:', error);
        res.status(500).json({ 
            success: false,
            message: 'Errore nel recupero dati utente',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/logout', authenticate, async (req, res) => {
    try {
        await UserToken.destroy({
            where: {
                userId: req.user.id,
                token: req.token
            }
        });
        
        console.log('✅ Logout effettuato per utente:', req.user.email);
        
        res.json({ 
            success: true,
            message: 'Logout effettuato con successo' 
        });
    } catch (error) {
        console.error('❌ Errore logout:', error);
        res.status(500).json({ 
            success: false,
            message: 'Errore durante il logout' 
        });
    }
});

router.post('/refresh', authenticate, async (req, res) => {
    try {
        const user = req.user;
        
        const newToken = jwt.sign(
            { 
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET || 'jwtmannoli2025',
            { expiresIn: '7d' }
        );
        
        try {
            await UserToken.create({
                userId: user.id,
                token: newToken
            });
        } catch (tokenError) {
            console.error('⚠️ Errore salvataggio nuovo token:', tokenError.message);
        }
        
        console.log('✅ Token refreshed per:', user.email);
        
        res.json({ 
            success: true,
            token: newToken 
        });
        
    } catch (error) {
        console.error('❌ Errore refresh token:', error);
        res.status(500).json({ 
            success: false,
            message: 'Errore nel refresh del token' 
        });
    }
});

router.get('/health', (req, res) => {
    res.json({ 
        success: true,
        message: 'Auth routes OK',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;