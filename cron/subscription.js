const cron = require('node-cron');
const { query } = require('../db-v2');

/**
 * Subscription Cron Job
 * Runs daily at 00:05
 * 
 * 1. Expires subscriptions that have passed their end_date and auto_renew = false
 * 2. Auto-renews subscriptions that have passed their end_date and auto_renew = true
 * 3. Downgrades subscriptions 1 day after end_date if not renewed
 */

async function processSubscriptions() {
    console.log('[SUBSCRIPTION CRON] Processing subscription renewals and expirations...');

    try {
        // 1. Expire cancelled subscriptions (auto_renew = false) that have passed their end_date
        const expired = await query(`
            UPDATE subscriptions 
            SET status = 'expired' 
            WHERE status = 'active' 
            AND end_date < NOW() 
            AND (auto_renew = false OR cancelled_at IS NOT NULL)
            RETURNING id, user_id
        `);
        if (expired.rows.length > 0) {
            console.log(`[SUBSCRIPTION CRON] Expired ${expired.rows.length} cancelled subscription(s)`);
        }

        // 2. Auto-renew active subscriptions where auto_renew = true and end_date has passed
        const toRenew = await query(`
            SELECT id, user_id, plan, end_date 
            FROM subscriptions 
            WHERE status = 'active' 
            AND end_date < NOW() 
            AND auto_renew = true 
            AND cancelled_at IS NULL
        `);

        for (const sub of toRenew.rows) {
            try {
                // Mark old subscription as expired
                await query(`UPDATE subscriptions SET status = 'expired' WHERE id = $1`, [sub.id]);

                // Create new subscription starting from old end_date
                const newStart = new Date(sub.end_date);
                const newEnd = new Date(newStart);
                newEnd.setMonth(newEnd.getMonth() + 1);

                await query(`
                    INSERT INTO subscriptions (user_id, plan, status, start_date, end_date, auto_renew)
                    VALUES ($1, $2, 'active', $3, $4, true)
                `, [sub.user_id, sub.plan || 'monthly', newStart.toISOString(), newEnd.toISOString()]);

                console.log(`[SUBSCRIPTION CRON] Auto-renewed subscription for user ${sub.user_id}`);
            } catch (renewErr) {
                console.error(`[SUBSCRIPTION CRON] Failed to renew subscription ${sub.id}:`, renewErr.message);
            }
        }

        // 3. Downgrade subscriptions that are 1 day past end_date and haven't been renewed
        // (This handles edge cases where renewal failed or was not processed)
        const toDowngrade = await query(`
            UPDATE subscriptions 
            SET status = 'expired' 
            WHERE status = 'active' 
            AND end_date < NOW() - INTERVAL '1 day'
            RETURNING id, user_id
        `);
        if (toDowngrade.rows.length > 0) {
            console.log(`[SUBSCRIPTION CRON] Force-expired ${toDowngrade.rows.length} overdue subscription(s)`);
        }

        console.log('[SUBSCRIPTION CRON] Processing complete.');
    } catch (err) {
        console.error('[SUBSCRIPTION CRON] Error:', err);
    }
}

function startSubscriptionCron() {
    // Run daily at 00:05
    cron.schedule('5 0 * * *', () => {
        processSubscriptions();
    }, {
        timezone: 'Europe/Istanbul'
    });
    console.log('[SUBSCRIPTION CRON] Scheduled for 00:05 daily (Europe/Istanbul)');
}

module.exports = { startSubscriptionCron, processSubscriptions };
