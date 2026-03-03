const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'meddoc-secret-key-2024';

function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token gerekli' });
    }

    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = getDb();
        const user = db.prepare('SELECT id, email, name, school_key, department_idx, role, created_at FROM users WHERE id = ?').get(decoded.userId);
        if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Geçersiz token' });
    }
}

function adminMiddleware(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Yetki yok' });
    }
    next();
}

module.exports = { authMiddleware, adminMiddleware, JWT_SECRET };
