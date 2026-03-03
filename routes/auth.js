const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/register
router.post('/register', (req, res) => {
    const { email, password, name, school_key, department_idx } = req.body;

    if (!email || !password || !school_key || department_idx === undefined) {
        return res.status(400).json({ error: 'Tüm alanlar gerekli' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    }

    const db = getDb();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
        return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
        'INSERT INTO users (email, password_hash, name, school_key, department_idx) VALUES (?, ?, ?, ?, ?)'
    ).run(email, hash, name || '', school_key, department_idx);

    const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
        token,
        user: {
            id: result.lastInsertRowid,
            email,
            name: name || '',
            school_key,
            department_idx,
            role: 'user'
        }
    });
});

// POST /api/login
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'E-posta ve şifre gerekli' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            school_key: user.school_key,
            department_idx: user.department_idx,
            role: user.role
        }
    });
});

// GET /api/me
router.get('/me', authMiddleware, (req, res) => {
    const db = getDb();

    // Get active subscription
    const sub = db.prepare(
        "SELECT * FROM subscriptions WHERE user_id = ? AND is_active = 1 AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1"
    ).get(req.user.id);

    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const usage = db.prepare(
        'SELECT seconds_used FROM daily_usage WHERE user_id = ? AND date = ?'
    ).get(req.user.id, today);

    // Get settings for trial
    const trialSeconds = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'trial_seconds'").get()?.value || '600');

    res.json({
        user: req.user,
        subscription: sub || null,
        hasActiveSubscription: !!sub,
        todayUsage: usage?.seconds_used || 0,
        trialSeconds,
        isTrialExpired: !sub && (usage?.seconds_used || 0) >= trialSeconds
    });
});

module.exports = router;
