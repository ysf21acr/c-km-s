const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { checkSubscription } = require('../middleware/subscription');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const redisClient = require('../services/redis');
const PDFDocument = require('pdfkit');

const router = express.Router();

// ──────────── USAGE TRACKING ────────────

// POST /api/usage/tick
router.post('/usage/tick', authMiddleware, async (req, res) => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const userId = req.user.id;

    const sub = db.prepare(
        "SELECT id FROM subscriptions WHERE user_id = ? AND is_active = 1 AND expires_at > datetime('now') LIMIT 1"
    ).get(userId);

    if (sub) return res.json({ allowed: true, unlimited: true });

    const trialSeconds = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'trial_seconds'").get()?.value || '600');
    let currentUsage = 0;
    const redisKey = `usage:${userId}:${today}`;

    if (redisClient.isOpen) {
        const val = await redisClient.incrBy(redisKey, 30);
        if (val === 30) {
            await redisClient.expire(redisKey, 86400); // 1 day
        }
        currentUsage = val;

        // Sync to DB for backup
        db.prepare(`
            INSERT INTO daily_usage (user_id, date, seconds_used)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, date) DO UPDATE SET seconds_used = ?
        `).run(userId, today, currentUsage, currentUsage);
    } else {
        const existing = db.prepare('SELECT id, seconds_used FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, today);
        if (existing) {
            currentUsage = existing.seconds_used + 30;
            db.prepare('UPDATE daily_usage SET seconds_used = ? WHERE id = ?').run(currentUsage, existing.id);
        } else {
            currentUsage = 30;
            db.prepare('INSERT INTO daily_usage (user_id, date, seconds_used) VALUES (?, ?, ?)').run(userId, today, 30);
        }
    }

    res.json({
        allowed: currentUsage < trialSeconds,
        unlimited: false,
        secondsUsed: currentUsage,
        secondsRemaining: Math.max(0, trialSeconds - currentUsage),
        trialSeconds
    });
});

// GET /api/usage/today
router.get('/usage/today', authMiddleware, async (req, res) => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const userId = req.user.id;

    const sub = db.prepare(
        "SELECT id FROM subscriptions WHERE user_id = ? AND is_active = 1 AND expires_at > datetime('now') LIMIT 1"
    ).get(userId);

    if (sub) return res.json({ unlimited: true, secondsUsed: 0, secondsRemaining: 999999, trialSeconds: 0 });

    const trialSeconds = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'trial_seconds'").get()?.value || '600');
    let used = 0;

    if (redisClient.isOpen) {
        const val = await redisClient.get(`usage:${userId}:${today}`);
        if (val) used = parseInt(val, 10);
    }

    if (used === 0) {
        const usage = db.prepare('SELECT seconds_used FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, today);
        used = usage?.seconds_used || 0;
    }

    res.json({ unlimited: false, secondsUsed: used, secondsRemaining: Math.max(0, trialSeconds - used), trialSeconds });
});

// ──────────── SUBSCRIPTION & PAYMENTS ────────────

// GET /api/user/subscription
router.get('/subscription', authMiddleware, async (req, res) => {
    const db = getDb();
    const sub = db.prepare(
        "SELECT plan, starts_at, expires_at, is_active FROM subscriptions WHERE user_id = ? AND is_active = 1 AND expires_at > datetime('now') LIMIT 1"
    ).get(req.user.id);

    res.json({
        subscription: sub || null,
        isPremium: !!sub
    });
});

// GET /api/user/payments
router.get('/payments', authMiddleware, (req, res) => {
    const db = getDb();
    const payments = db.prepare('SELECT id, payment_id, price, paid_price, currency, status, created_at, card_brand, last_four_digits FROM payments WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(payments);
});

// GET /api/user/payments/:id/invoice
router.get('/payments/:id/invoice', authMiddleware, (req, res) => {
    const db = getDb();
    const payment = db.prepare('SELECT p.*, u.name, u.email FROM payments p JOIN users u ON p.user_id = u.id WHERE p.id = ? AND p.user_id = ?').get(req.params.id, req.user.id);

    if (!payment) return res.status(404).json({ error: 'Fatura bulunamadı' });

    const doc = new PDFDocument({ margin: 50 });
    let filename = `fatura_${payment.payment_id}.pdf`;

    res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-type', 'application/pdf');

    // Header
    doc.fontSize(20).text('MedDoc Akademi', { align: 'center' });
    doc.fontSize(12).text('Premium Abonelik Faturası', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(12).text(`Fatura No: ${payment.payment_id}`);
    doc.text(`Tarih: ${new Date(payment.created_at).toLocaleString('tr-TR')}`);
    doc.moveDown();

    doc.text(`Müşteri: ${payment.name}`);
    doc.text(`Email: ${payment.email}`);
    doc.moveDown(2);

    // Table Header
    doc.rect(50, doc.y, 500, 20).fill('#eeeeee');
    doc.fillColor('black').text('Açıklama', 60, doc.y + 6);
    doc.text('Tutar', 450, doc.y - 14, { align: 'right' });

    // Table content
    doc.moveDown(1);
    doc.text('1 Aylık Premium Abonelik', 60, doc.y);
    doc.text(`${payment.paid_price} ${payment.currency}`, 450, doc.y - 14, { align: 'right' });

    doc.moveDown(2);
    doc.text(`Durum: ${payment.status === 'SUCCESS' ? 'Ödendi' : payment.status}`, { align: 'right' });
    if (payment.card_brand) {
        doc.text(`Ödeme Yöntemi: ${payment.card_brand} **** ${payment.last_four_digits}`, { align: 'right' });
    }

    doc.pipe(res);
    doc.end();
});

// POST /api/user/subscription/cancel
router.post('/subscription/cancel', authMiddleware, (req, res) => {
    const db = getDb();
    // In a real scenario, you'd call Iyzico's subscription API to cancel the recurring billing here.
    // For this implementation, we just mark it as inactive in our DB so it won't renew or is immediately canceled.
    db.prepare('UPDATE subscriptions SET is_active = 0 WHERE user_id = ?').run(req.user.id);
    res.json({ success: true, message: 'Aboneliğiniz iptal edildi.' });
});

// ──────────── DATA ────────────

// GET /api/data/schools
router.get('/data/schools', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'school_data.json'), 'utf8'));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Veri yüklenemedi' });
    }
});

// GET /api/data/settings
router.get('/data/settings', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const s = {};
    rows.forEach(r => { s[r.key] = r.value; });
    res.json(s);
});

// ──────────── QUIZ ────────────

// GET /api/quiz/questions?course=CourseName&limit=10
router.get('/quiz/questions', authMiddleware, checkSubscription, (req, res) => {
    const db = getDb();
    const course = req.query.course || '';
    const limit = parseInt(req.query.limit) || 10;

    let questions;
    if (course) {
        questions = db.prepare(
            'SELECT id, course_name, question_text, options, correct_idx, explanation FROM questions WHERE course_name = ? ORDER BY RANDOM() LIMIT ?'
        ).all(course, limit);
    } else {
        questions = db.prepare(
            'SELECT id, course_name, question_text, options, correct_idx, explanation FROM questions ORDER BY RANDOM() LIMIT ?'
        ).all(limit);
    }

    questions = questions.map(q => ({
        ...q,
        options: JSON.parse(q.options || '[]')
    }));

    res.json(questions);
});

// POST /api/quiz/answer
router.post('/quiz/answer', authMiddleware, checkSubscription, (req, res) => {
    const db = getDb();
    const { question_id, selected_idx } = req.body;

    if (question_id === undefined || selected_idx === undefined) {
        return res.status(400).json({ error: 'question_id ve selected_idx gerekli' });
    }

    const question = db.prepare('SELECT correct_idx, explanation FROM questions WHERE id = ?').get(question_id);
    if (!question) return res.status(404).json({ error: 'Soru bulunamadı' });

    const is_correct = selected_idx === question.correct_idx ? 1 : 0;

    db.prepare(
        'INSERT INTO user_answers (user_id, question_id, selected_idx, is_correct) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, question_id, selected_idx, is_correct);

    res.json({
        correct: !!is_correct,
        correct_idx: question.correct_idx,
        explanation: question.explanation
    });
});

// GET /api/quiz/mistakes — Yanlış yapılan sorular
router.get('/quiz/mistakes', authMiddleware, (req, res) => {
    const db = getDb();

    const mistakes = db.prepare(`
    SELECT q.id, q.course_name, q.question_text, q.options, q.correct_idx, q.explanation,
           ua.selected_idx, ua.answered_at
    FROM user_answers ua
    JOIN questions q ON ua.question_id = q.id
    WHERE ua.user_id = ? AND ua.is_correct = 0
    ORDER BY ua.answered_at DESC
    LIMIT 50
  `).all(req.user.id);

    res.json(mistakes.map(m => ({ ...m, options: JSON.parse(m.options || '[]') })));
});

// GET /api/quiz/mistakes/review — Hatalı soruları quiz olarak sun
router.get('/quiz/mistakes/review', authMiddleware, (req, res) => {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 10;

    // Get distinct wrong questions (not yet correctly re-answered)
    const questions = db.prepare(`
    SELECT DISTINCT q.id, q.course_name, q.question_text, q.options, q.correct_idx, q.explanation
    FROM user_answers ua
    JOIN questions q ON ua.question_id = q.id
    WHERE ua.user_id = ? AND ua.is_correct = 0
      AND q.id NOT IN (
        SELECT question_id FROM user_answers WHERE user_id = ? AND is_correct = 1 AND answered_at > ua.answered_at
      )
    ORDER BY RANDOM()
    LIMIT ?
  `).all(req.user.id, req.user.id, limit);

    res.json(questions.map(q => ({ ...q, options: JSON.parse(q.options || '[]') })));
});

// GET /api/quiz/courses — Soru bulunan derslerin listesi
router.get('/quiz/courses', authMiddleware, (req, res) => {
    const db = getDb();
    const courses = db.prepare(
        'SELECT course_name, COUNT(*) as count FROM questions GROUP BY course_name ORDER BY count DESC'
    ).all();
    res.json(courses);
});

// ──────────── ANALYTICS ────────────

// GET /api/analytics
router.get('/analytics', authMiddleware, (req, res) => {
    const db = getDb();

    // Overall stats
    const total = db.prepare('SELECT COUNT(*) as c FROM user_answers WHERE user_id = ?').get(req.user.id).c;
    const correct = db.prepare('SELECT COUNT(*) as c FROM user_answers WHERE user_id = ? AND is_correct = 1').get(req.user.id).c;

    // Per course stats (for radar chart)
    const perCourse = db.prepare(`
    SELECT q.course_name,
           COUNT(*) as total,
           SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct
    FROM user_answers ua
    JOIN questions q ON ua.question_id = q.id
    WHERE ua.user_id = ?
    GROUP BY q.course_name
    ORDER BY total DESC
    LIMIT 8
  `).all(req.user.id);

    // Last 7 days daily stats
    const daily = db.prepare(`
    SELECT date(ua.answered_at) as day,
           COUNT(*) as total,
           SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct
    FROM user_answers ua
    WHERE ua.user_id = ? AND ua.answered_at >= datetime('now', '-7 days')
    GROUP BY date(ua.answered_at)
    ORDER BY day
  `).all(req.user.id);

    res.json({
        overall: { total, correct, wrong: total - correct, rate: total > 0 ? Math.round((correct / total) * 100) : 0 },
        perCourse,
        daily
    });
});

// ──────────── FEEDBACK ────────────

// POST /api/feedback
router.post('/feedback', authMiddleware, (req, res) => {
    const db = getDb();
    const { subject, message } = req.body;

    if (!message) return res.status(400).json({ error: 'Mesaj gerekli' });

    db.prepare(
        'INSERT INTO feedback (user_id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, req.user.name, req.user.email, subject || 'Genel', message);

    res.json({ success: true });
});

module.exports = router;
