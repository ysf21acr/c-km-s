const express = require('express');
const bcrypt = require('bcryptjs');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../../middleware/v2/auth');
const { query, pool } = require('../../db-v2');

router.use(authMiddleware, adminMiddleware);

const runningScrapeJobs = new Map();

function normalizeScrapeJobKey(value) {
    const normalized = String(value || 'ALL').trim().toUpperCase();
    return normalized || 'ALL';
}

async function reconcileOrphanScrapeLogs() {
    const runningLogs = await query(`
        SELECT id, COALESCE(log_data->>'university_key', 'ALL') AS university_key
        FROM scraper_logs
        WHERE status = 'running'
    `);

    for (const row of runningLogs.rows) {
        const jobKey = normalizeScrapeJobKey(row.university_key);
        if (runningScrapeJobs.has(jobKey)) continue;

        await query(`
            UPDATE scraper_logs
            SET status = 'error',
                duration_seconds = GREATEST(COALESCE(duration_seconds, 0), EXTRACT(EPOCH FROM (NOW() - created_at))::int),
                error_message = COALESCE(error_message, 'Islem yarida kaldi veya sunucu yeniden baslatildi.'),
                log_data = COALESCE(log_data, '{}'::jsonb) || $2::jsonb
            WHERE id = $1 AND status = 'running'
        `, [row.id, JSON.stringify({
            university_key: jobKey,
            stage: 'orphaned',
            active: false
        })]);
    }
}

function parsePage(v, fallback) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function ensureUploadsDir() {
    const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    return uploadsDir;
}

function dataUrlToBuffer(input) {
    const str = String(input || '');
    const m = str.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
    if (!m) return null;
    return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
}

async function setSetting(key, value) {
    await query(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [key, String(value)]);
}

function normalizePlan(value) {
    return String(value || 'free').toLowerCase() === 'premium' ? 'premium' : 'free';
}

async function getPremiumPlanId(client) {
    const result = await client.query(`
        SELECT id
        FROM subscription_plans
        WHERE is_active = true
        ORDER BY
            CASE WHEN LOWER(name) = 'premium' THEN 0 ELSE 1 END,
            monthly_price DESC,
            created_at ASC
        LIMIT 1
    `);
    return result.rows[0]?.id || null;
}

async function syncUserPlanWithClient(client, userId, planInput) {
    const plan = normalizePlan(planInput);

    await client.query(`
        UPDATE subscriptions
        SET status = 'expired'
        WHERE user_id = $1 AND status = 'active'
    `, [userId]);

    // Legacy/optional columns may not exist in every deployed schema.
    await client.query(`
        UPDATE subscriptions
        SET auto_renew = false,
            cancelled_at = COALESCE(cancelled_at, NOW())
        WHERE user_id = $1 AND status <> 'active'
    `, [userId]).catch(() => { });

    await client.query(`
        UPDATE user_subscriptions
        SET status = 'expired'
        WHERE user_id = $1 AND status = 'active'
    `, [userId]);

    if (plan === 'premium') {
        const premiumPlanId = await getPremiumPlanId(client);
        if (!premiumPlanId) {
            const err = new Error('PREMIUM_PLAN_NOT_FOUND');
            err.code = 'PREMIUM_PLAN_NOT_FOUND';
            throw err;
        }

        await client.query(`
            INSERT INTO subscriptions (user_id, plan, status, start_date, end_date)
            VALUES ($1, 'premium', 'active', NOW(), NOW() + INTERVAL '1 month')
        `, [userId]);

        await client.query(`
            UPDATE subscriptions
            SET auto_renew = false,
                cancelled_at = NULL
            WHERE id IN (
                SELECT id
                FROM subscriptions
                WHERE user_id = $1 AND status = 'active'
                ORDER BY created_at DESC
                LIMIT 1
            )
        `, [userId]).catch(() => { });

        await client.query(`
            INSERT INTO user_subscriptions (user_id, plan_id, status, starts_at, expires_at)
            VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '1 month')
        `, [userId, premiumPlanId]);
    }
}

async function getEffectivePlan(client, userId) {
    const result = await client.query(`
        SELECT
            EXISTS(
                SELECT 1
                FROM subscriptions
                WHERE user_id = $1 AND status = 'active' AND end_date > NOW()
            ) AS has_legacy,
            EXISTS(
                SELECT 1
                FROM user_subscriptions
                WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
            ) AS has_v2
    `, [userId]);

    const row = result.rows[0] || {};
    return (row.has_legacy || row.has_v2) ? 'premium' : 'free';
}

// DASHBOARD
router.get('/dashboard/metrics', async (req, res) => {
    try {
        const [totalUsers, activePremium, todayRegs, monthlyRevenue, totalQuestions, totalExams, unreadMessages] = await Promise.all([
            query('SELECT COUNT(*)::int AS count FROM users'),
            query("SELECT COUNT(*)::int AS count FROM subscriptions WHERE status = 'active' AND end_date > NOW()"),
            query("SELECT COUNT(*)::int AS count FROM users WHERE created_at >= CURRENT_DATE"),
            query("SELECT COALESCE(SUM(CAST(paid_price AS DECIMAL)), 0) AS rev FROM payments WHERE status = 'SUCCESS' AND created_at >= date_trunc('month', NOW())"),
            query('SELECT COUNT(*)::int AS count FROM questions'),
            query('SELECT COUNT(*)::int AS count FROM exams'),
            query("SELECT COUNT(*)::int AS count FROM contact_messages WHERE status = 'unread'")
        ]);

        res.json({
            totalUsers: totalUsers.rows[0].count,
            activePremium: activePremium.rows[0].count,
            todayRegistrations: todayRegs.rows[0].count,
            monthlyRevenue: Number(monthlyRevenue.rows[0].rev || 0),
            totalQuestions: totalQuestions.rows[0].count,
            totalExams: totalExams.rows[0].count,
            unreadMessages: unreadMessages.rows[0].count
        });
    } catch (err) {
        console.error('Admin metrics error:', err);
        res.status(500).json({ error: 'Metrikler alÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±namadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

// USERS
router.get('/users', async (req, res) => {
    try {
        const page = parsePage(req.query.page, 1);
        const limit = parsePage(req.query.limit, 50);
        const offset = (page - 1) * limit;
        const search = String(req.query.search || '').trim();

        let where = '';
        const params = [];
        if (search) {
            params.push(`%${search}%`);
            where = `WHERE (u.email ILIKE $${params.length} OR u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length})`;
        }
        params.push(limit, offset);

        const usersSql = `
            SELECT
                u.id, u.email, u.first_name, u.last_name, u.role, u.is_active, u.created_at, u.last_login,
                uni.name AS university_name,
                dep.name AS department_name,
                CASE WHEN s_legacy.id IS NOT NULL OR s_v2.id IS NOT NULL THEN 'premium' ELSE 'free' END AS plan,
                u.university_id,
                u.department_id
            FROM users u
            LEFT JOIN universities uni ON uni.id = u.university_id
            LEFT JOIN departments dep ON dep.id = u.department_id
            LEFT JOIN LATERAL (
                SELECT id FROM subscriptions
                WHERE user_id = u.id AND status = 'active' AND end_date > NOW()
                ORDER BY end_date DESC
                LIMIT 1
            ) s_legacy ON true
            LEFT JOIN LATERAL (
                SELECT id FROM user_subscriptions
                WHERE user_id = u.id AND status = 'active' AND expires_at > NOW()
                ORDER BY expires_at DESC
                LIMIT 1
            ) s_v2 ON true
            ${where}
            ORDER BY u.created_at DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `;
        const countSql = `SELECT COUNT(*)::int AS count FROM users u ${where}`;

        const [usersResult, countResult] = await Promise.all([
            query(usersSql, params),
            query(countSql, search ? [params[0]] : [])
        ]);

        res.json({
            data: usersResult.rows,
            total: countResult.rows[0].count,
            page,
            totalPages: Math.max(1, Math.ceil(countResult.rows[0].count / limit))
        });
    } catch (err) {
        console.error('Admin users list error:', err);
        res.status(500).json({ error: 'KullanÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±cÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±lar listelenemedi.' });
    }
});

router.get('/universities', async (req, res) => {
    try {
        const result = await query('SELECT id, name FROM universities ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error('Universities error:', err);
        res.status(500).json({ error: 'ÃƒÆ’Ã†â€™Ãƒâ€¦Ã¢â‚¬Å“niversiteler alÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±namadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

router.get('/departments', async (req, res) => {
    try {
        const universityId = req.query.university_id;
        if (!universityId) return res.json([]);
        const result = await query('SELECT id, name FROM departments WHERE university_id = $1 ORDER BY name', [universityId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Departments error:', err);
        res.status(500).json({ error: 'BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¶lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼mler alÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±namadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

router.post('/users', async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            email, password, first_name, last_name, plan = 'free',
            university_id = null, department_id = null
        } = req.body || {};

        if (!email || !password || !first_name || !last_name) {
            return res.status(400).json({ error: 'E-posta, ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸ifre, ad ve soyad zorunludur.' });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ error: 'ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Âifre en az 6 karakter olmalÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±dÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±r.' });
        }

        await client.query('BEGIN');

        const exists = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (exists.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Bu e-posta zaten kayÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±tlÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
        }

        const hash = await bcrypt.hash(password, 10);
        const inserted = await client.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, university_id, department_id, is_active)
            VALUES ($1, $2, $3, $4, 'user', $5, $6, true)
            RETURNING id
        `, [email, hash, first_name, last_name, university_id || null, department_id || null]);

        await syncUserPlanWithClient(client, inserted.rows[0].id, plan);
        const effectivePlan = await getEffectivePlan(client, inserted.rows[0].id);
        await client.query('COMMIT');

        res.status(201).json({ success: true, id: inserted.rows[0].id, effective_plan: effectivePlan });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('Create user error:', err);
        if (err.code === 'PREMIUM_PLAN_NOT_FOUND') {
            return res.status(400).json({ error: 'Aktif bir premium plan bulunamadÃƒâ€Ã‚Â±. ÃƒÆ’Ã¢â‚¬â€œnce planlar ekranÃƒâ€Ã‚Â±ndan premium planÃƒâ€Ã‚Â± aktif edin.' });
        }
        res.status(500).json({ error: 'KullanÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±cÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± oluÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸turulamadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    } finally {
        client.release();
    }
});

router.put('/users/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const id = req.params.id;
        const {
            email, first_name, last_name, plan, university_id, department_id, is_active
        } = req.body || {};

        await client.query('BEGIN');

        await client.query(`
            UPDATE users
            SET email = COALESCE($2, email),
                first_name = COALESCE($3, first_name),
                last_name = COALESCE($4, last_name),
                university_id = $5,
                department_id = $6,
                is_active = COALESCE($7, is_active)
            WHERE id = $1
        `, [id, email || null, first_name || null, last_name || null, university_id || null, department_id || null, is_active]);

        if (plan !== undefined) {
            await syncUserPlanWithClient(client, id, plan);
        }

        const effectivePlan = await getEffectivePlan(client, id);
        await client.query('COMMIT');
        res.json({ success: true, effective_plan: effectivePlan });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('Update user error:', err);
        if (err.code === 'PREMIUM_PLAN_NOT_FOUND') {
            return res.status(400).json({ error: 'Aktif bir premium plan bulunamadÃƒâ€Ã‚Â±. ÃƒÆ’Ã¢â‚¬â€œnce planlar ekranÃƒâ€Ã‚Â±ndan premium planÃƒâ€Ã‚Â± aktif edin.' });
        }
        res.status(500).json({ error: 'KullanÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±cÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ncellenemedi.' });
    } finally {
        client.release();
    }
});
router.put('/users/:id/toggle-status', async (req, res) => {
    try {
        await query('UPDATE users SET is_active = NOT is_active WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Toggle user status error:', err);
        res.status(500).json({ error: 'KullanÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±cÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± durumu gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ncellenemedi.' });
    }
});

router.put('/users/:id/reset-password', async (req, res) => {
    try {
        const { new_password } = req.body || {};
        if (!new_password || String(new_password).length < 6) {
            return res.status(400).json({ error: 'Yeni ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸ifre en az 6 karakter olmalÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±dÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±r.' });
        }
        const hash = await bcrypt.hash(new_password, 10);
        await query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.params.id, hash]);
        res.json({ success: true });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Âifre sÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±fÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±rlanamadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        await query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'KullanÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±cÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± silinemedi.' });
    }
});

// PLANS
router.get('/plans', async (req, res) => {
    try {
        const result = await query('SELECT id, name, monthly_price, daily_free_minutes, is_active FROM subscription_plans ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Plans list error:', err);
        res.status(500).json({ error: 'Planlar alÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±namadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

router.post('/plans', async (req, res) => {
    try {
        const { name, monthly_price, daily_free_minutes = 10, is_active = true } = req.body || {};
        if (!name || monthly_price === undefined) {
            return res.status(400).json({ error: 'Plan adÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± ve aylÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±k ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼cret zorunludur.' });
        }
        const ins = await query(`
            INSERT INTO subscription_plans (name, monthly_price, daily_free_minutes, is_active)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, monthly_price, daily_free_minutes, is_active
        `, [name, monthly_price, daily_free_minutes, !!is_active]);

        if (is_active) {
            await setSetting('monthly_price', monthly_price);
        }
        res.status(201).json(ins.rows[0]);
    } catch (err) {
        console.error('Create plan error:', err);
        res.status(500).json({ error: 'Plan oluÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸turulamadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

router.put('/plans/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { name, monthly_price, daily_free_minutes, is_active } = req.body || {};

        const updated = await query(`
            UPDATE subscription_plans
            SET name = COALESCE($2, name),
                monthly_price = COALESCE($3, monthly_price),
                daily_free_minutes = COALESCE($4, daily_free_minutes),
                is_active = COALESCE($5, is_active)
            WHERE id = $1
            RETURNING id, name, monthly_price, daily_free_minutes, is_active
        `, [id, name || null, monthly_price, daily_free_minutes, is_active]);

        if (updated.rows.length === 0) {
            return res.status(404).json({ error: 'Plan bulunamadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
        }

        if (updated.rows[0].is_active && updated.rows[0].monthly_price !== undefined) {
            await setSetting('monthly_price', updated.rows[0].monthly_price);
        }

        res.json(updated.rows[0]);
    } catch (err) {
        console.error('Update plan error:', err);
        res.status(500).json({ error: 'Plan gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ncellenemedi.' });
    }
});

// SUBSCRIPTIONS
router.get('/subscriptions', async (req, res) => {
    try {
        const page = parsePage(req.query.page, 1);
        const limit = parsePage(req.query.limit, 50);
        const offset = (page - 1) * limit;

        const [list, count] = await Promise.all([
            query(`
                SELECT
                    s.id, s.user_id, s.plan, s.status, s.start_date, s.end_date, s.created_at,
                    u.first_name, u.last_name, u.email
                FROM subscriptions s
                JOIN users u ON u.id = s.user_id
                ORDER BY s.created_at DESC
                LIMIT $1 OFFSET $2
            `, [limit, offset]),
            query('SELECT COUNT(*)::int AS count FROM subscriptions')
        ]);

        res.json({
            data: list.rows,
            total: count.rows[0].count,
            page,
            totalPages: Math.max(1, Math.ceil(count.rows[0].count / limit))
        });
    } catch (err) {
        console.error('Subscriptions list error:', err);
        res.status(500).json({ error: 'Abonelikler alÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±namadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

router.put('/subscriptions/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { status, end_date } = req.body || {};
        await query(`
            UPDATE subscriptions
            SET status = COALESCE($2, status),
                end_date = COALESCE($3, end_date)
            WHERE id = $1
        `, [id, status || null, end_date || null]);
        res.json({ success: true });
    } catch (err) {
        console.error('Update subscription error:', err);
        res.status(500).json({ error: 'Abonelik gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ncellenemedi.' });
    }
});

// SETTINGS (site-integrated)
router.get('/settings', async (req, res) => {
    try {
        const result = await query("SELECT key, value FROM settings");
        const settings = {};
        result.rows.forEach(r => { settings[r.key] = r.value; });
        res.json(settings);
    } catch (err) {
        console.error('Settings read error:', err);
        res.status(500).json({ error: 'Ayarlar alÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±namadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

router.put('/settings', async (req, res) => {
    try {
        const payload = req.body || {};
        const keys = Object.keys(payload);
        for (const key of keys) {
            await setSetting(key, payload[key]);
        }
        res.json({ success: true, message: 'Ayarlar gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ncellendi.' });
    } catch (err) {
        console.error('Settings update error:', err);
        res.status(500).json({ error: 'Ayarlar gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ncellenemedi.' });
    }
});

router.get('/profile', async (req, res) => {
    try {
        const adminId = req.user.id || req.user.userId;
        const result = await query('SELECT id, email, first_name, last_name, role FROM users WHERE id = $1', [adminId]);
        if (!result.rows.length) return res.status(404).json({ error: 'Admin bulunamadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get admin profile error:', err);
        res.status(500).json({ error: 'Admin profili alÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±namadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

router.put('/profile', async (req, res) => {
    try {
        const adminId = req.user.id || req.user.userId;
        const { email, first_name, last_name, current_password, new_password } = req.body || {};
        const current = await query('SELECT id, email, password_hash FROM users WHERE id = $1', [adminId]);
        if (!current.rows.length) return res.status(404).json({ error: 'Admin bulunamadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
        const admin = current.rows[0];

        if (email && email !== admin.email) {
            const exists = await query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, adminId]);
            if (exists.rows.length > 0) return res.status(409).json({ error: 'Bu e-posta zaten kullanÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±mda.' });
        }

        if (new_password) {
            if (!current_password) return res.status(400).json({ error: 'Mevcut ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸ifre zorunludur.' });
            const ok = await bcrypt.compare(current_password, admin.password_hash);
            if (!ok) return res.status(400).json({ error: 'Mevcut ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸ifre hatalÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
            if (String(new_password).length < 6) return res.status(400).json({ error: 'Yeni ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸ifre en az 6 karakter olmalÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±dÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±r.' });
            const newHash = await bcrypt.hash(new_password, 10);
            await query('UPDATE users SET password_hash = $2 WHERE id = $1', [adminId, newHash]);
        }

        await query(`
            UPDATE users
            SET email = COALESCE($2, email),
                first_name = COALESCE($3, first_name),
                last_name = COALESCE($4, last_name)
            WHERE id = $1
        `, [adminId, email || null, first_name || null, last_name || null]);

        const updated = await query('SELECT id, email, first_name, last_name, role FROM users WHERE id = $1', [adminId]);
        res.json({ success: true, user: updated.rows[0] });
    } catch (err) {
        console.error('Update admin profile error:', err);
        res.status(500).json({ error: 'Admin profili gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ncellenemedi.' });
    }
});

router.get('/branding', async (req, res) => {
    try {
        const result = await query("SELECT key, value FROM settings WHERE key IN ('site_logo_url', 'site_favicon_url')");
        const branding = { site_logo_url: '', site_favicon_url: '' };
        result.rows.forEach(r => { branding[r.key] = r.value; });
        res.json(branding);
    } catch (err) {
        console.error('Get branding error:', err);
        res.status(500).json({ error: 'Marka ayarlarÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± alÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±namadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

router.put('/branding', async (req, res) => {
    try {
        const { site_logo_url, site_favicon_url } = req.body || {};
        if (site_logo_url !== undefined) await setSetting('site_logo_url', site_logo_url || '');
        if (site_favicon_url !== undefined) await setSetting('site_favicon_url', site_favicon_url || '');
        res.json({ success: true });
    } catch (err) {
        console.error('Update branding error:', err);
        res.status(500).json({ error: 'Marka ayarlarÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ncellenemedi.' });
    }
});

router.post('/branding/upload', async (req, res) => {
    try {
        const { type, file_name, file_data } = req.body || {};
        if (!type || !['logo', 'favicon'].includes(type)) {
            return res.status(400).json({ error: 'Dosya tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ geÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ersiz.' });
        }
        const parsed = dataUrlToBuffer(file_data);
        if (!parsed) return res.status(400).json({ error: 'Dosya verisi geÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ersiz.' });

        const uploadsDir = ensureUploadsDir();
        const safeExt = path.extname(String(file_name || '')).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase();
        const ext = safeExt || (parsed.mime.includes('png') ? '.png' : parsed.mime.includes('svg') ? '.svg' : '.bin');
        const outName = `${type}-${Date.now()}${ext}`;
        const outPath = path.join(uploadsDir, outName);
        fs.writeFileSync(outPath, parsed.buffer);

        const publicUrl = `/uploads/${outName}`;
        if (type === 'logo') await setSetting('site_logo_url', publicUrl);
        if (type === 'favicon') await setSetting('site_favicon_url', publicUrl);

        res.json({ success: true, url: publicUrl });
    } catch (err) {
        console.error('Branding upload error:', err);
        res.status(500).json({ error: 'Dosya yÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼klenemedi.' });
    }
});

// MESSAGES
router.get('/messages', async (req, res) => {
    try {
        const page = parsePage(req.query.page, 1);
        const limit = parsePage(req.query.limit, 50);
        const offset = (page - 1) * limit;

        const msgs = await query('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
        const totalRes = await query('SELECT COUNT(*)::int AS count FROM contact_messages');

        res.json({
            messages: msgs.rows,
            total: totalRes.rows[0].count,
            page,
            totalPages: Math.max(1, Math.ceil(totalRes.rows[0].count / limit))
        });
    } catch (err) {
        console.error('Messages list error:', err);
        res.status(500).json({ error: 'Mesajlar alÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±namadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

router.put('/messages/:id/status', async (req, res) => {
    try {
        const { status } = req.body || {};
        await query('UPDATE contact_messages SET status = $2 WHERE id = $1', [req.params.id, status || 'read']);
        res.json({ success: true });
    } catch (err) {
        console.error('Message status update error:', err);
        res.status(500).json({ error: 'Mesaj durumu gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ncellenemedi.' });
    }
});

router.put('/messages/:id/reply', async (req, res) => {
    try {
        const { reply } = req.body || {};
        if (!reply || !String(reply).trim()) {
            return res.status(400).json({ error: 'YanÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±t metni boÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€¦Ã‚Â¸ olamaz.' });
        }
        await query(`
            UPDATE contact_messages
            SET admin_reply = $2, status = 'replied'
            WHERE id = $1
        `, [req.params.id, String(reply).trim()]);
        res.json({ success: true });
    } catch (err) {
        console.error('Message reply error:', err);
        res.status(500).json({ error: 'Mesaj yanÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±tlanamadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

router.delete('/messages/:id', async (req, res) => {
    try {
        await query('DELETE FROM contact_messages WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete message error:', err);
        res.status(500).json({ error: 'Mesaj silinemedi.' });
    }
});

// SCRAPER
router.get('/data/stats', async (req, res) => {
    try {
        const [u, d, c, e, q] = await Promise.all([
            query('SELECT COUNT(*)::int AS count FROM universities'),
            query('SELECT COUNT(*)::int AS count FROM departments'),
            query('SELECT COUNT(*)::int AS count FROM courses'),
            query('SELECT COUNT(*)::int AS count FROM exams'),
            query('SELECT COUNT(*)::int AS count FROM questions')
        ]);
        res.json({
            universities: u.rows[0].count,
            departments: d.rows[0].count,
            courses: c.rows[0].count,
            exams: e.rows[0].count,
            questions: q.rows[0].count
        });
    } catch (err) {
        console.error('Data stats error:', err);
        res.status(500).json({ error: 'ÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â°statistikler alÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±namadÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±.' });
    }
});

router.get('/scraper/logs', async (req, res) => {
    try {
        await reconcileOrphanScrapeLogs();
        await query(`
            UPDATE scraper_logs
            SET status = 'error',
                error_message = COALESCE(error_message, 'Ã„Â°Ã…Å¸lem yarÃ„Â±da kaldÃ„Â± (sunucu yeniden baÃ…Å¸latÃ„Â±lmÃ„Â±Ã…Å¸ olabilir).')
            WHERE status = 'running'
              AND created_at < NOW() - INTERVAL '30 minutes'
        `);

        const logs = await query(`
            SELECT
                sl.id,
                sl.status,
                sl.duration_seconds,
                sl.questions_added,
                sl.error_message,
                sl.created_at,
                sl.log_data->>'university_key' AS university_key,
                sl.log_data->>'stage' AS stage,
                sl.log_data->>'current_department' AS current_department,
                sl.log_data->>'current_course' AS current_course,
                sl.log_data->>'last_completed_course' AS last_completed_course,
                sl.log_data->>'last_error' AS last_error,
                COALESCE((sl.log_data->>'departments_total')::int, 0) AS departments_total,
                COALESCE((sl.log_data->>'departments_done')::int, 0) AS departments_done,
                COALESCE((sl.log_data->>'courses_total')::int, 0) AS courses_total,
                COALESCE((sl.log_data->>'courses_done')::int, 0) AS courses_done,
                COALESCE((sl.log_data->>'questions_found')::int, 0) AS questions_found,
                COALESCE((sl.log_data->>'questions_saved')::int, 0) AS questions_saved,
                COALESCE((sl.log_data->>'errors_count')::int, 0) AS errors_count,
                COALESCE((sl.log_data->>'last_course_questions')::int, 0) AS last_course_questions,
                COALESCE((sl.log_data->>'department_progress_pct')::int, 0) AS department_progress_pct,
                COALESCE((sl.log_data->>'course_progress_pct')::int, 0) AS course_progress_pct,
                COALESCE((sl.log_data->>'overall_progress_pct')::int, 0) AS overall_progress_pct
            FROM scraper_logs sl
            ORDER BY sl.created_at DESC
            LIMIT 100
        `);
        const rows = logs.rows.map((row) => {
            const jobKey = normalizeScrapeJobKey(row.university_key);
            const active = row.status === 'running' && runningScrapeJobs.has(jobKey);
            if (row.status === 'running' && !active) {
                row.status = 'error';
                row.stage = row.stage || 'orphaned';
                row.error_message = row.error_message || 'Islem yarida kaldi veya sunucu yeniden baslatildi.';
            }
            return {
                ...row,
                active,
                can_stop: active
            };
        });
        res.json(rows);
    } catch (err) {
        console.error('Scraper logs error:', err);
        res.status(500).json({ error: 'Scraper loglarÃƒâ€Ã‚Â± alÃƒâ€Ã‚Â±namadÃƒâ€Ã‚Â±.' });
    }
});

router.post('/scraper/start', async (req, res) => {
    try {
        const schoolKey = normalizeScrapeJobKey(req.body?.university_key || req.body?.university || '');
        const jobKey = schoolKey;
        if (runningScrapeJobs.has(jobKey)) {
            return res.status(409).json({ error: 'Bu kaynak iÃƒÆ’Ã‚Â§in aktif bir scraper iÃƒâ€¦Ã…Â¸i zaten ÃƒÆ’Ã‚Â§alÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±yor.' });
        }

        const beforeQ = await query('SELECT COUNT(*)::int AS count FROM questions');
        const startedAt = Date.now();

        const sourceInsert = await query(`
            INSERT INTO scraper_logs (status, duration_seconds, questions_added, log_data)
            VALUES ('running', 0, 0, $1)
            RETURNING id
        `, [JSON.stringify({
            university_key: jobKey,
            stage: 'starting',
            current_department: null,
            current_course: null,
            last_completed_course: null,
            last_error: null,
            departments_total: 0,
            departments_done: 0,
            courses_total: 0,
            courses_done: 0,
            questions_found: 0,
            questions_saved: 0,
            errors_count: 0,
            active: true,
            stop_requested: false
        })]);
        const logId = sourceInsert.rows[0].id;

        const scraperPath = path.join(__dirname, '..', '..', 'scraper_v2.js');
        const child = spawn(process.execPath, [scraperPath], {
            env: {
                ...process.env,
                FILTER_SCHOOL: jobKey === 'ALL' ? '' : jobKey,
                SCRAPER_EXIT_ON_COMPLETE: '1'
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let outBuf = '';
        let errBuf = '';
        let stdoutCarry = '';
        let latestProgress = {};
        let closed = false;

        async function applyProgressUpdate(progressPayload) {
            if (!progressPayload || typeof progressPayload !== 'object') return;
            latestProgress = { ...latestProgress, ...progressPayload };
            await query(`
                UPDATE scraper_logs
                SET log_data = COALESCE(log_data, '{}'::jsonb) || $2::jsonb
                WHERE id = $1
            `, [logId, JSON.stringify(latestProgress)]);
        }

        const progressTimer = setInterval(async () => {
            try {
                const nowCount = await query('SELECT COUNT(*)::int AS count FROM questions');
                const liveAdded = Math.max(
                    Number(latestProgress.questions_saved || 0),
                    Math.max(0, nowCount.rows[0].count - beforeQ.rows[0].count)
                );
                const liveDuration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
                await query(`
                    UPDATE scraper_logs
                    SET duration_seconds = $2,
                        questions_added = $3,
                        log_data = COALESCE(log_data, '{}'::jsonb) || $4::jsonb
                    WHERE id = $1 AND status = 'running'
                `, [logId, liveDuration, liveAdded, JSON.stringify({
                    active: true,
                    pid: child.pid
                })]);
            } catch (e) {
                console.error('Scraper progress update error:', e);
            }
        }, 5000);

        runningScrapeJobs.set(jobKey, { pid: child.pid, logId, startedAt, child, stopRequested: false });
        await applyProgressUpdate({ university_key: jobKey, stage: 'running', active: true, pid: child.pid });

        child.stdout.on('data', async (d) => {
            const chunk = d.toString();
            outBuf += chunk;
            if (outBuf.length > 8000) outBuf = outBuf.slice(-8000);

            stdoutCarry += chunk;
            const lines = stdoutCarry.split(/\r?\n/);
            stdoutCarry = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('__PROGRESS__ ')) continue;
                const rawJson = trimmed.slice('__PROGRESS__ '.length);
                try {
                    const progress = JSON.parse(rawJson);
                    await applyProgressUpdate(progress);
                } catch (e) {
                    // Keep scraper running even if one progress frame cannot be parsed.
                }
            }
        });

        child.stderr.on('data', (d) => {
            errBuf += d.toString();
            if (errBuf.length > 8000) errBuf = errBuf.slice(-8000);
        });

        child.on('error', async (spawnErr) => {
            if (closed) return;
            closed = true;
            clearInterval(progressTimer);
            try {
                const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
                await query(`
                    UPDATE scraper_logs
                    SET status = 'error',
                        duration_seconds = $2,
                        error_message = $3
                    WHERE id = $1
                `, [logId, duration, String(spawnErr?.message || 'Scraper process baÃƒâ€¦Ã…Â¸latÃƒâ€Ã‚Â±lamadÃƒâ€Ã‚Â±').slice(0, 2000)]);
            } catch (e) {
                console.error('Scraper spawn error finalize failed:', e);
            } finally {
                runningScrapeJobs.delete(jobKey);
            }
        });

        child.on('close', async (code) => {
            if (closed) return;
            closed = true;
            clearInterval(progressTimer);
            try {
                const jobInfo = runningScrapeJobs.get(jobKey);
                const manuallyStopped = !!jobInfo?.stopRequested;
                const afterQ = await query('SELECT COUNT(*)::int AS count FROM questions');
                const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
                const added = Math.max(
                    Number(latestProgress.questions_saved || 0),
                    Math.max(0, afterQ.rows[0].count - beforeQ.rows[0].count)
                );
                const status = manuallyStopped ? 'error' : (code === 0 ? 'success' : 'error');
                const combinedErr = `${errBuf}\n${outBuf}`.trim();
                const msg = manuallyStopped
                    ? 'İşlem manuel olarak durduruldu.'
                    : status === 'error'
                        ? (combinedErr ? combinedErr.slice(-2000) : `Scraper ${code} kodu ile sonlandı.`)
                        : null;
                await query(`
                    UPDATE scraper_logs
                    SET status = $2,
                        duration_seconds = $3,
                        questions_added = $4,
                        error_message = $5,
                        log_data = COALESCE(log_data, '{}'::jsonb) || $6::jsonb
                    WHERE id = $1
                `, [logId, status, duration, added, msg, JSON.stringify({
                    ...latestProgress,
                    active: false,
                    stage: manuallyStopped ? 'stopped' : (status === 'success' ? 'completed' : 'error'),
                    stop_requested: manuallyStopped,
                    last_error: msg || latestProgress.last_error || null,
                    department_progress_pct: status === 'success' ? 100 : (latestProgress.department_progress_pct || 0),
                    course_progress_pct: status === 'success' ? 100 : (latestProgress.course_progress_pct || 0),
                    overall_progress_pct: status === 'success' ? 100 : (latestProgress.overall_progress_pct || 0)
                })]);
            } catch (e) {
                console.error('Scraper log finalize error:', e);
            } finally {
                runningScrapeJobs.delete(jobKey);
            }
        });

        res.json({ success: true, log_id: logId, pid: child.pid });
    } catch (err) {
        console.error('Start scraper error:', err);
        res.status(500).json({ error: 'Veri ÃƒÆ’Ã‚Â§ekme baÃƒâ€¦Ã…Â¸latÃƒâ€Ã‚Â±lamadÃƒâ€Ã‚Â±.' });
    }
});

router.post('/scraper/stop', async (req, res) => {
    try {
        const jobKey = normalizeScrapeJobKey(req.body?.university_key || req.body?.university || '');
        const job = runningScrapeJobs.get(jobKey);

        if (job?.child) {
            job.stopRequested = true;
            await query(`
                UPDATE scraper_logs
                SET log_data = COALESCE(log_data, '{}'::jsonb) || $2::jsonb
                WHERE id = $1
            `, [job.logId, JSON.stringify({
                stop_requested: true,
                stage: 'stopping',
                active: true
            })]).catch(() => { });
            try {
                job.child.kill('SIGTERM');
            } catch (_) {
                try {
                    job.child.kill();
                } catch (__ignored) {
                    // Finalization will fallback to DB update below if process cannot be signaled.
                }
            }
            return res.json({ success: true, message: 'Stop sinyali gonderildi.' });
        }

        const stopResult = await query(`
            UPDATE scraper_logs
            SET status = 'error',
                error_message = COALESCE(error_message, 'Islem manuel olarak durduruldu.'),
                duration_seconds = GREATEST(duration_seconds, EXTRACT(EPOCH FROM (NOW() - created_at))::int),
                log_data = COALESCE(log_data, '{}'::jsonb) || $2::jsonb
            WHERE id = (
                SELECT id
                FROM scraper_logs
                WHERE status = 'running'
                  AND COALESCE(log_data->>'university_key', 'ALL') = $1
                ORDER BY created_at DESC
                LIMIT 1
            )
            RETURNING id
        `, [jobKey, JSON.stringify({
            university_key: jobKey,
            active: false,
            stop_requested: true,
            stage: 'stopped'
        })]);

        if (stopResult.rowCount > 0) {
            return res.json({ success: true, message: 'Calisan log kaydi manuel olarak durduruldu.' });
        }

        return res.status(404).json({ error: 'Durdurulacak aktif is bulunamadi.' });
    } catch (err) {
        console.error('Stop scraper error:', err);
        res.status(500).json({ error: 'Veri cekme durdurulamadi.' });
    }
});

router.post('/scraper/logs/clear', async (req, res) => {
    try {
        await query('DELETE FROM scraper_logs WHERE status != $1', ['running']);
        res.json({ success: true, message: 'Geçmiş işlemler temizlendi.' });
    } catch (err) {
        console.error('Clear scraper logs error:', err);
        res.status(500).json({ error: 'İşlemler temizlenemedi.' });
    }
});

module.exports = router;
