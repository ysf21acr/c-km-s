const { query } = require('../../db-v2');
const redis = require('redis');
require('dotenv').config();

let redisClient;
(async () => {
    redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    await redisClient.connect().catch(e => console.error('Redis connect error (v2)', e));
})();

async function subscriptionMiddleware(req, res, next) {
    const userId = req.user.id;
    try {
        // 1. Check if user has an active premium subscription
        const subResult = await query(`
            SELECT * FROM user_subscriptions 
            WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
        `, [userId]);

        if (subResult.rows.length > 0) {
            req.isPremium = true;
            return next();
        }

        req.isPremium = false;

        // 2. Not premium, check daily free limit using Redis
        // Find default plan daily limit (assuming 10 minutes)
        const dailyLimitSeconds = 10 * 60;

        const today = new Date().toISOString().split('T')[0];
        const redisKey = `user:usage:${userId}:${today}`;

        let usage = await redisClient.get(redisKey);
        usage = usage ? parseInt(usage) : 0;

        if (usage >= dailyLimitSeconds) {
            return res.status(402).json({ error: 'Günlük ücretsiz kullanım süreniz doldu.', allowed: false });
        }

        req.freeSecondsRemaining = dailyLimitSeconds - usage;
        next();
    } catch (err) {
        console.error('Subscription middleware error:', err);
        res.status(500).json({ error: 'Abonelik durumu kontrol edilemedi.' });
    }
}

module.exports = { subscriptionMiddleware, redisClient };
