const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'meddoc-super-secret-key-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'meddoc-super-secret-refresh-key-change-me';

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Erişim reddedildi. Token bulunamadı.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Geçersiz token.' });
        req.user = user;
        next();
    });
}

function adminMiddleware(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Yetkisiz erişim. Sadece admin görüntüleyebilir.' });
    }
}

module.exports = {
    authMiddleware,
    adminMiddleware,
    JWT_SECRET,
    JWT_REFRESH_SECRET
};
