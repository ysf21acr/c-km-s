const express = require('express');
const { getDb } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

// ──────────── STATS ────────────

router.get('/stats', (req, res) => {
    const db = getDb();
    const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'user'").get().c;
    const activeSubscriptions = db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE is_active = 1 AND expires_at > datetime('now')").get().c;
    const last7Days = db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now', '-7 days')").get().c;
    const totalQuizSessions = db.prepare("SELECT COUNT(*) as c FROM daily_usage").get().c;
    const totalQuestions = db.prepare("SELECT COUNT(*) as c FROM questions").get().c;
    const totalAnswers = db.prepare("SELECT COUNT(*) as c FROM user_answers").get().c;
    const unreadFeedback = db.prepare("SELECT COUNT(*) as c FROM feedback WHERE is_read = 0").get().c;

    res.json({ totalUsers, activeSubscriptions, last7DaysRegistrations: last7Days, totalQuizSessions, totalQuestions, totalAnswers, unreadFeedback });
});

// ──────────── SETTINGS ────────────

router.get('/settings', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const s = {};
    rows.forEach(r => { s[r.key] = r.value; });
    res.json(s);
});

router.put('/settings', (req, res) => {
    const db = getDb();
    const { settings } = req.body;
    if (!settings) return res.status(400).json({ error: 'settings gerekli' });

    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    const tx = db.transaction((entries) => { for (const [k, v] of entries) upsert.run(k, String(v)); });
    tx(Object.entries(settings));
    res.json({ success: true });
});

// ──────────── USERS ────────────

router.get('/users', (req, res) => {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    const params = [];

    let where = "WHERE u.role = 'user'";
    if (search) {
        where += " AND (u.email LIKE ? OR u.name LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
    }

    const total = db.prepare(`SELECT COUNT(*) as c FROM users u ${where}`).get(...params).c;
    const users = db.prepare(`
    SELECT u.id, u.email, u.name, u.school_key, u.department_idx, u.role, u.auth_provider, u.created_at,
      (SELECT COUNT(*) FROM subscriptions s WHERE s.user_id = u.id AND s.is_active = 1 AND s.expires_at > datetime('now')) as has_sub
    FROM users u ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

    res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
});

router.put('/users/:id/subscription', (req, res) => {
    const db = getDb();
    const { action, days } = req.body;
    const userId = req.params.id;

    if (action === 'grant') {
        const d = days || 30;
        db.prepare("INSERT INTO subscriptions (user_id, plan, starts_at, expires_at, is_active) VALUES (?, 'monthly', datetime('now'), datetime('now', '+' || ? || ' days'), 1)").run(userId, d);
        res.json({ success: true });
    } else if (action === 'revoke') {
        db.prepare("UPDATE subscriptions SET is_active = 0 WHERE user_id = ? AND is_active = 1").run(userId);
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "action 'grant' veya 'revoke' olmalı" });
    }
});

router.delete('/users/:id', (req, res) => {
    const db = getDb();
    const id = req.params.id;
    db.prepare('DELETE FROM user_answers WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM daily_usage WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM feedback WHERE user_id = ?').run(id);
    db.prepare("DELETE FROM users WHERE id = ? AND role != 'admin'").run(id);
    res.json({ success: true });
});

// ──────────── FEEDBACK ────────────

router.get('/feedback', (req, res) => {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const total = db.prepare('SELECT COUNT(*) as c FROM feedback').get().c;
    const items = db.prepare(
        'SELECT f.*, u.email as user_email FROM feedback f LEFT JOIN users u ON f.user_id = u.id ORDER BY f.created_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);

    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
});

router.put('/feedback/:id/read', (req, res) => {
    const db = getDb();
    db.prepare('UPDATE feedback SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ──────────── SCRAPE LOGS ────────────

router.get('/scrape-logs', (req, res) => {
    const db = getDb();
    const logs = db.prepare('SELECT * FROM scrape_logs ORDER BY started_at DESC LIMIT 20').all();
    res.json(logs);
});

router.post('/scrape-now', async (req, res) => {
    try {
        const { runLolonolo } = require('../cron/scraper');
        res.json({ success: true, message: 'Lolonolo scraper başlatıldı. Bu işlem birkaç dakika sürebilir.' });
        // Run async in background
        runLolonolo().catch(e => console.error('Admin scrape error:', e.message));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
