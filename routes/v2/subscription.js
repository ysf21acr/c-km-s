const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/v2/auth');
const { subscriptionMiddleware, redisClient } = require('../../middleware/v2/subscription');
const { query } = require('../../db-v2');

// Get Subscription Status
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const subResult = await query(`
            SELECT s.*, p.name as plan_name, p.daily_free_minutes 
            FROM user_subscriptions s
            JOIN subscription_plans p ON s.plan_id = p.id
            WHERE s.user_id = $1 AND s.status = 'active' AND s.expires_at > NOW()
            ORDER BY s.expires_at DESC LIMIT 1
        `, [userId]);

        const hasActiveSubscription = subResult.rows.length > 0;
        const subscriptionContent = hasActiveSubscription ? subResult.rows[0] : null;

        // Daily usage
        const today = new Date().toISOString().split('T')[0];
        const redisKey = `user:usage:${userId}:${today}`;
        const usageRes = await redisClient.get(redisKey);
        const todayUsage = usageRes ? parseInt(usageRes) : 0;
        const defaultDailySeconds = 10 * 60; // 10 minutes

        res.json({
            isPremium: hasActiveSubscription,
            planDetails: subscriptionContent,
            dailyRemainingSeconds: hasActiveSubscription ? null : Math.max(0, defaultDailySeconds - todayUsage)
        });
    } catch (err) {
        console.error('Subscription check error:', err);
        res.status(500).json({ error: 'Abonelik bilgileri alınamadı.' });
    }
});

// Tick usage (for free users)
router.post('/tick', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Quickly check if premium from DB since subscriptionMiddleware handles req.isPremium
        const subResult = await query(`
            SELECT id FROM user_subscriptions 
            WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
        `, [userId]);

        const isPremium = subResult.rows.length > 0;

        if (isPremium) {
            return res.json({ allowed: true, unlimited: true });
        }

        const today = new Date().toISOString().split('T')[0];
        const redisKey = `user:usage:${userId}:${today}`;
        const defaultDailySeconds = 10 * 60;

        let usage = await redisClient.get(redisKey);
        usage = usage ? parseInt(usage) : 0;

        if (usage >= defaultDailySeconds) {
            return res.status(402).json({ error: 'Günlük ücretsiz kullanım süreniz doldu.', allowed: false });
        }

        const tickAmount = 30; // increments of 30 seconds
        usage += tickAmount;

        // Update redis with 24 hr expiration
        await redisClient.setEx(redisKey, 86400, usage.toString());

        res.json({ allowed: true, remaining: Math.max(0, defaultDailySeconds - usage) });
    } catch (err) {
        console.error('Usage tick error:', err);
        res.status(500).json({ error: 'Süre takip edilemedi.' });
    }
});

module.exports = router;
