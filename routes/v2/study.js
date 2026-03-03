const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware } = require('../../middleware/v2/auth');
const { subscriptionMiddleware, redisClient } = require('../../middleware/v2/subscription');
const { validate } = require('../../middleware/v2/validate');
const { query } = require('../../db-v2');

// GET Universities hierarchy
router.get('/universities', authMiddleware, async (req, res) => {
    try {
        const result = await query('SELECT * FROM universities WHERE is_active = true ORDER BY name ASC');
        res.json({ data: result.rows });
    } catch (e) {
        console.error('Universities fetch error:', e);
        res.status(500).json({ error: 'Veri çekilemedi.' });
    }
});

// GET Questions (requires active subscription OR free time)
router.get('/exams/:exam_id/questions', authMiddleware, subscriptionMiddleware, async (req, res) => {
    try {
        const { exam_id } = req.params;

        // Try to get from Redis Cache first
        const cacheKey = `exam:${exam_id}:questions`;
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            return res.json({ questions: JSON.parse(cached) });
        }

        const result = await query('SELECT id, question_text, options, explanation FROM questions WHERE exam_id = $1', [exam_id]);

        // Cache for 1 hour
        if (result.rows.length > 0) {
            await redisClient.setEx(cacheKey, 3600, JSON.stringify(result.rows));
        }

        res.json({ questions: result.rows });
    } catch (e) {
        console.error('Questions error:', e);
        res.status(500).json({ error: 'Sorular yüklenemedi.' });
    }
});

// POST Question Attempt
const attemptSchema = z.object({
    body: z.object({
        question_id: z.string().uuid(),
        selected_option: z.string().max(10),
        is_correct: z.boolean(),
        time_spent_seconds: z.number().int().min(0).optional()
    })
});

router.post('/attempt', authMiddleware, validate(attemptSchema), async (req, res) => {
    try {
        const userId = req.user.id;
        const { question_id, selected_option, is_correct, time_spent_seconds } = req.body;

        await query(`
            INSERT INTO user_question_attempts (user_id, question_id, selected_option, is_correct, time_spent_seconds)
            VALUES ($1, $2, $3, $4, $5)
        `, [userId, question_id, selected_option, is_correct, time_spent_seconds || 0]);

        res.status(201).json({ success: true });
    } catch (e) {
        console.error('Attempt save error:', e);
        res.status(500).json({ error: 'Sonuç kaydedilemedi.' });
    }
});

// GET Statistics
router.get('/stats/dashboard', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Example summary stats
        const summaryRes = await query(`
            SELECT 
                COUNT(*) as total_answered,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as total_correct
            FROM user_question_attempts
            WHERE user_id = $1
        `, [userId]);

        const total = parseInt(summaryRes.rows[0].total_answered) || 0;
        const correct = parseInt(summaryRes.rows[0].total_correct) || 0;
        const correctRate = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;

        // Example trend stats (last 7 days)
        const trendRes = await query(`
            SELECT 
                DATE(created_at) as date,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
                SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END) as wrong
            FROM user_question_attempts
            WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [userId]);

        res.json({
            totalAnswered: total,
            correctRate: parseFloat(correctRate),
            weeklyTrend: trendRes.rows,
            subjectHeatmap: [] // Implement join with questions/exams/courses later
        });

    } catch (e) {
        console.error('Stats error:', e);
        res.status(500).json({ error: 'İstatistikler oluşturulamadı.' });
    }
});

module.exports = router;
