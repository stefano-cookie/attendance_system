const jwt = require('jsonwebtoken');
const { sequelize } = require('../config/database');

exports.authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                message: 'Token mancante o non valido',
                code: 'MISSING_TOKEN'
            });
        }

        const token = authHeader.split(' ')[1];
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwtmannoli2025');
        
        try {
            await sequelize.authenticate();
        } catch (dbError) {
            console.error('Errore connessione database:', dbError.message);
            return res.status(500).json({ 
                message: 'Errore del server - database non disponibile',
                code: 'DB_CONNECTION_ERROR'
            });
        }

        const { User } = require('../models');
        
        const user = await User.findByPk(decoded.id);
        
        if (!user) {
            return res.status(401).json({ 
                message: 'Utente non trovato',
                code: 'USER_NOT_FOUND'
            });
        }

        req.user = user;
        req.token = token;
        next();
        
    } catch (error) {
        console.error('Errore di autenticazione:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                message: 'Token non valido',
                code: 'INVALID_TOKEN'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: 'Token scaduto',
                code: 'EXPIRED_TOKEN'
            });
        }
        
        return res.status(500).json({ 
            message: 'Errore del server durante l\'autenticazione',
            code: 'SERVER_ERROR'
        });
    }
};

exports.requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                message: 'Autenticazione richiesta',
                code: 'AUTH_REQUIRED'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: 'Non hai i permessi per accedere a questa risorsa',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        next();
    };
};

exports.isAdmin = (req, res, next) => {
    return exports.requireRole(['admin'])(req, res, next);
};

exports.isTechnician = (req, res, next) => {
    return exports.requireRole(['technician', 'admin'])(req, res, next);
};