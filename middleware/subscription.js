const { getDb } = require('../db');
const redisClient = require('../services/redis');

async function checkSubscription(req, res, next) {
    try {
        const db = getDb();
        const userId = req.user.id;
        const today = new Date().toISOString().split('T')[0];

        const sub = db.prepare(
            "SELECT id FROM subscriptions WHERE user_id = ? AND is_active = 1 AND expires_at > datetime('now') LIMIT 1"
        ).get(userId);

        if (sub) {
            req.isPremium = true;
            return next();
        }

        req.isPremium = false;

        const redisKey = `usage:${userId}:${today}`;
        let usedSeconds = 0;

        if (redisClient.isOpen) {
            const val = await redisClient.get(redisKey);
            if (val) {
                usedSeconds = parseInt(val, 10);
            } else {
                const usageRow = db.prepare('SELECT seconds_used FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, today);
                usedSeconds = usageRow ? usageRow.seconds_used : 0;
                await redisClient.setEx(redisKey, 86400, usedSeconds.toString());
            }
        } else {
            const usageRow = db.prepare('SELECT seconds_used FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, today);
            usedSeconds = usageRow ? usageRow.seconds_used : 0;
        }

        const trialSecondsRow = db.prepare("SELECT value FROM settings WHERE key = 'trial_seconds'").get();
        const trialSeconds = trialSecondsRow ? parseInt(trialSecondsRow.value, 10) : 600;

        if (usedSeconds >= trialSeconds) {
            return res.status(402).json({
                error: 'Günlük ücretsiz kullanım süreniz doldu.',
                secondsRemaining: 0,
                trialSeconds
            });
        }

        req.usedSeconds = usedSeconds;
        req.trialSeconds = trialSeconds;
        next();
    } catch (err) {
        console.error('Subscription middleware error:', err);
        next();
    }
}

module.exports = { checkSubscription };
