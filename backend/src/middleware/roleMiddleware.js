exports.requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Autenticazione richiesta' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: 'Non hai i permessi per accedere a questa risorsa' 
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

exports.isTeacher = (req, res, next) => {
    return exports.requireRole(['teacher'])(req, res, next);
};

exports.isTeacherOrAdmin = (req, res, next) => {
    return exports.requireRole(['teacher', 'admin'])(req, res, next);
};