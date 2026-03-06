const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../db-v2');

const JWT_SECRET = process.env.JWT_SECRET || 'meddoc-super-secret-key-change-me';

// ============================================================
// COMPATIBILITY ROUTES — bridges old frontend API → V2 backend
// ============================================================

// POST /api/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gereklidir.' });

        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
        }
        if (!user.is_active) return res.status(403).json({ error: 'Hesabınız askıya alınmış.' });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        delete user.password_hash;

        res.json({ token, user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Giriş sırasında bir hata oluştu' });
    }
});

// POST /api/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, school_key, department_idx } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gereklidir.' });

        const regSetting = await query("SELECT value FROM settings WHERE key = 'registration_enabled'").catch(() => ({ rows: [] }));
        const isRegEnabled = String(regSetting.rows[0]?.value || 'true').toLowerCase() !== 'false';
        if (!isRegEnabled) {
            return res.status(403).json({ error: 'Yeni kullanıcı kaydı geçici olarak kapatılmıştır.' });
        }

        const checkUser = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (checkUser.rows.length > 0) return res.status(400).json({ error: 'Bu e-posta adresiyle kayıtlı bir hesap zaten var.' });

        // Split name into first/last
        const parts = (name || '').trim().split(' ');
        const first_name = parts[0] || 'Kullanıcı';
        const last_name = parts.slice(1).join(' ') || '';

        const password_hash = await bcrypt.hash(password, 10);

        // Get university/department info if provided
        let university_id = null;
        let department_id = null;
        if (school_key) {
            // Try to match university by name pattern
            const nameMap = { 'AUZEF': '%AUZEF%', 'ANADOLU_AOF': '%Anadolu%', 'ATATURK_AOF': '%Atat_rk%' };
            const pattern = nameMap[school_key] || `%${school_key}%`;
            const uniResult = await query('SELECT id FROM universities WHERE name ILIKE $1', [pattern]);
            if (uniResult.rows.length > 0) {
                university_id = uniResult.rows[0].id;

                if (department_idx !== undefined && department_idx !== null) {
                    const deptsResult = await query('SELECT id FROM departments WHERE university_id = $1 ORDER BY name', [university_id]);
                    if (deptsResult.rows[department_idx]) {
                        department_id = deptsResult.rows[department_idx].id;
                    }
                }
            }
        }

        const result = await query(`
            INSERT INTO users (email, password_hash, first_name, last_name, university_id, department_id)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role
        `, [email, password_hash, first_name, last_name, university_id, department_id]);

        const newUser = result.rows[0];
        const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            token,
            user: { ...newUser, name: `${first_name} ${last_name}`.trim() }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu' });
    }
});

// GET /api/data/schools — returns university→department→course hierarchy
router.get('/data/schools', async (req, res) => {
    try {
        const universities = await query('SELECT id, name, source_url FROM universities ORDER BY name');
        const departments = await query('SELECT id, name, university_id FROM departments ORDER BY name');
        const courses = await query('SELECT id, name, department_id FROM courses ORDER BY name');

        const result = {};
        for (const uni of universities.rows) {
            const uniDepts = departments.rows.filter(d => d.university_id === uni.id);
            // Generate key from name
            let key = uni.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
            const upperName = uni.name.toUpperCase();
            if (upperName.includes('AUZEF')) key = 'AUZEF';
            else if (upperName.includes('ANADOLU')) key = 'ANADOLU_AOF';
            else if (upperName.includes('ATATÜRK') || upperName.includes('ATATURK')) key = 'ATATURK_AOF';
            result[key] = {
                name: uni.name,
                departments: uniDepts.map(dept => ({
                    name: dept.name,
                    courses: courses.rows.filter(c => c.department_id === dept.id).map(c => ({ name: c.name }))
                }))
            };
        }

        // If DB is empty, return sample data so the UI isn't blank
        if (Object.keys(result).length === 0) {
            return res.json({
                AUZEF: {
                    name: 'İstanbul Üniversitesi AUZEF',
                    departments: [
                        { name: 'Tıp Fakültesi', courses: [{ name: 'Anatomi' }, { name: 'Fizyoloji' }, { name: 'Biyokimya' }] },
                        { name: 'Eczacılık Fakültesi', courses: [{ name: 'Farmakoloji' }, { name: 'Farmakognozi' }] },
                        { name: 'Diş Hekimliği', courses: [{ name: 'Oral Patoloji' }, { name: 'Periodontoloji' }] },
                    ]
                },
                ANADOLU_AOF: {
                    name: 'Anadolu Üniversitesi AÖF',
                    departments: [
                        { name: 'Hemşirelik', courses: [{ name: 'Temel Hemşirelik' }, { name: 'Cerrahi Hemşireliği' }] },
                        { name: 'Sağlık Yönetimi', courses: [{ name: 'Sağlık Ekonomisi' }] },
                        { name: 'Laborant ve Veteriner Sağlık', courses: [{ name: 'Mikrobiyoloji' }] },
                    ]
                },
                ATATURK_AOF: {
                    name: 'Atatürk Üniversitesi AÖF',
                    departments: [
                        { name: 'Tıbbi Laboratuvar', courses: [{ name: 'Biyokimya' }, { name: 'Hematoloji' }] },
                        { name: 'Fizyoterapi', courses: [{ name: 'Rehabilitasyon' }] },
                    ]
                }
            });
        }

        res.json(result);
    } catch (err) {
        console.error('Schools data error:', err);
        res.status(500).json({ error: 'Okul verileri yüklenemedi' });
    }
});

// GET /api/user — returns current user from token
router.get('/user', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await query('SELECT id, email, first_name, last_name, role, university_id FROM users WHERE id = $1', [decoded.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

        const user = result.rows[0];
        user.name = `${user.first_name} ${user.last_name}`.trim();
        res.json({ user });
    } catch (err) {
        res.status(401).json({ error: 'Geçersiz token' });
    }
});

// GET /api/data/exams — returns exams for user's department with question counts
router.get('/data/exams', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const userResult = await query('SELECT university_id, department_id FROM users WHERE id = $1', [decoded.id]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

        const uniId = userResult.rows[0].university_id;

        // Get department_id from user profile or query param
        let deptId = req.query.department_id || userResult.rows[0].department_id;

        if (uniId && !deptId) {
            const depts = await query('SELECT id FROM departments WHERE university_id = $1 LIMIT 1', [uniId]);
            if (depts.rows.length > 0) deptId = depts.rows[0].id;
        }

        let exams = [];
        let hasDepartmentExams = false;
        if (deptId) {
            // Load exams for specific department
            const deptExams = await query(`
                SELECT e.id, e.year, e.term, e.type, c.name as course_name,
                       COUNT(q.id) as question_count
                FROM exams e
                JOIN courses c ON c.id = e.course_id
                JOIN departments d ON d.id = c.department_id
                LEFT JOIN questions q ON q.exam_id = e.id
                WHERE d.id = $1
                GROUP BY e.id, e.year, e.term, e.type, c.name
                HAVING COUNT(q.id) > 0
                ORDER BY c.name, e.year DESC
            `, [deptId]);

            if (deptExams.rows.length > 0) {
                exams = deptExams;
                hasDepartmentExams = true;
            }
        }

        if (!hasDepartmentExams) {
            // Fallback: load ALL available exams when no department is set or empty department
            exams = await query(`
                SELECT e.id, e.year, e.term, e.type, c.name as course_name,
                       COUNT(q.id) as question_count
                FROM exams e
                JOIN courses c ON c.id = e.course_id
                LEFT JOIN questions q ON q.exam_id = e.id
                GROUP BY e.id, e.year, e.term, e.type, c.name
                HAVING COUNT(q.id) > 0
                ORDER BY c.name, e.year DESC
                LIMIT 200
            `);
        }

        res.json(exams.rows);
    } catch (err) {
        console.error('Exams data error:', err);
        res.status(500).json({ error: 'Sınav verileri yüklenemedi' });
    }
});

// GET /api/data/departments — returns departments for a university
router.get('/data/departments', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const userResult = await query('SELECT university_id FROM users WHERE id = $1', [decoded.id]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

        const uniId = userResult.rows[0].university_id;
        if (!uniId) return res.json([]);

        const depts = await query('SELECT id, name FROM departments WHERE university_id = $1 ORDER BY name', [uniId]);
        res.json(depts.rows);
    } catch (err) {
        console.error('Departments error:', err);
        res.status(500).json({ error: 'Bölüm verileri yüklenemedi' });
    }
});

// GET /api/quiz/exam/:examId — returns questions for a specific exam
router.get('/quiz/exam/:examId', async (req, res) => {
    try {
        const { examId } = req.params;
        const limit = req.query.limit || 20;
        const questions = await query(`
            SELECT id, question_text, options, explanation FROM questions
            WHERE exam_id = $1 ORDER BY RANDOM() LIMIT $2
        `, [examId, limit]);

        // Parse options JSON and format for frontend
        const formatted = questions.rows.map(q => {
            let opts = q.options;
            if (typeof opts === 'string') opts = JSON.parse(opts);
            const correct = opts.correct;
            const optArray = ['A', 'B', 'C', 'D', 'E'].filter(k => opts[k]).map(k => opts[k]);
            const correctIdx = ['A', 'B', 'C', 'D', 'E'].indexOf(correct);
            return {
                id: q.id,
                question_text: q.question_text,
                options: optArray,
                correct_idx: correctIdx >= 0 ? correctIdx : 0,
                explanation: q.explanation || ''
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Exam questions error:', err);
        res.status(500).json({ error: 'Sınav soruları yüklenemedi' });
    }
});
// GET /api/me — returns current user profile + subscription info
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await query(`
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.university_id, u.department_id, u.created_at,
                   uni.name as university_name, dep.name as department_name
            FROM users u
            LEFT JOIN universities uni ON uni.id = u.university_id
            LEFT JOIN departments dep ON dep.id = u.department_id
            WHERE u.id = $1
        `, [decoded.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        const user = result.rows[0];
        user.name = `${user.first_name} ${user.last_name}`.trim();

        // Generate correct frontend school_key
        if (user.university_name) {
            let key = user.university_name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
            const upperName = user.university_name.toUpperCase();
            if (upperName.includes('AUZEF')) key = 'AUZEF';
            else if (upperName.includes('ANADOLU')) key = 'ANADOLU_AOF';
            else if (upperName.includes('ATATÜRK') || upperName.includes('ATATURK')) key = 'ATATURK_AOF';
            user.school_key = key;
        } else {
            user.school_key = null;
        }

        // Subscription check (active and NOT expired)
        const subCheck = await query(`SELECT id, end_date, auto_renew, cancelled_at FROM subscriptions WHERE user_id = $1 AND status = 'active' AND end_date > NOW() ORDER BY end_date DESC LIMIT 1`, [user.id]);
        const hasActiveSubscription = subCheck.rows.length > 0;
        const activeSub = subCheck.rows[0] || null;

        // Subscription details for frontend
        let subscription_end_date = null;
        let subscription_cancelled = false;
        let subscription_days_remaining = 0;
        if (activeSub) {
            subscription_end_date = activeSub.end_date;
            subscription_cancelled = activeSub.cancelled_at !== null || activeSub.auto_renew === false;
            const endDate = new Date(activeSub.end_date);
            const now = new Date();
            subscription_days_remaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
        }

        // Today's usage
        const usageResult = await query(`SELECT COALESCE(SUM(seconds_used), 0) as total FROM usage_log WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE`, [user.id]).catch(() => ({ rows: [{ total: 0 }] }));
        const todayUsage = parseInt(usageResult.rows[0]?.total || 0);

        // Trial seconds from settings
        const settingsResult = await query("SELECT value FROM settings WHERE key = 'trial_seconds'").catch(() => ({ rows: [] }));
        const trialSeconds = parseInt(settingsResult.rows[0]?.value || 600);

        res.json({ user, hasActiveSubscription, trialSeconds, todayUsage, subscription_end_date, subscription_cancelled, subscription_days_remaining });
    } catch (err) {
        console.error('Me error:', err);
        res.status(401).json({ error: 'Geçersiz token' });
    }
});

// POST /api/subscription/cancel — soft cancel (keeps active until expiry)
router.post('/subscription/cancel', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);

        const subResult = await query(`SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active' AND end_date > NOW() ORDER BY end_date DESC LIMIT 1`, [decoded.id]);
        if (subResult.rows.length === 0) {
            return res.status(404).json({ error: 'Aktif abonelik bulunamadı.' });
        }

        await query(`UPDATE subscriptions SET auto_renew = false, cancelled_at = NOW() WHERE id = $1`, [subResult.rows[0].id]);

        res.json({ success: true, message: 'Abonelik iptal edildi. Süresi dolana kadar aktif kalacaktır.' });
    } catch (err) {
        console.error('Cancel subscription error:', err);
        res.status(500).json({ error: 'Abonelik iptal edilemedi.' });
    }
});

// GET /api/data/settings — returns monthly price and trial settings
router.get('/data/settings', async (req, res) => {
    try {
        const result = await query("SELECT key, value FROM settings WHERE key IN ('monthly_price', 'trial_seconds', 'site_name', 'maintenance_mode', 'registration_enabled', 'max_daily_questions', 'site_logo_url', 'site_favicon_url')").catch(() => ({ rows: [] }));
        const settings = {};
        result.rows.forEach(r => { settings[r.key] = r.value; });
        res.json({
            monthly_price: settings.monthly_price || '49.99',
            trial_seconds: parseInt(settings.trial_seconds || 600),
            site_name: settings.site_name || 'Açık ve Uzaktan Akademi',
            maintenance_mode: settings.maintenance_mode || 'false',
            registration_enabled: settings.registration_enabled || 'true',
            max_daily_questions: settings.max_daily_questions || '100',
            site_logo_url: settings.site_logo_url || '',
            site_favicon_url: settings.site_favicon_url || ''
        });
    } catch (err) {
        res.json({
            monthly_price: '49.99',
            trial_seconds: 600,
            site_name: 'Açık ve Uzaktan Akademi',
            maintenance_mode: 'false',
            registration_enabled: 'true',
            max_daily_questions: '100',
            site_logo_url: '',
            site_favicon_url: ''
        });
    }
});

// POST /api/quiz/answer — answer a question
router.post('/quiz/answer', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { question_id, selected_idx } = req.body;

        // Get question
        const qResult = await query('SELECT id, question_text, options, explanation FROM questions WHERE id = $1', [question_id]);
        if (qResult.rows.length === 0) return res.status(404).json({ error: 'Soru bulunamadı' });
        const q = qResult.rows[0];
        let opts = q.options;
        if (typeof opts === 'string') opts = JSON.parse(opts);
        const correctLetter = opts.correct;
        const correctIdx = ['A', 'B', 'C', 'D', 'E'].indexOf(correctLetter);
        const isCorrect = selected_idx === correctIdx;

        // Get course name for the question
        const courseResult = await query(`
            SELECT c.name FROM courses c JOIN exams e ON e.course_id = c.id JOIN questions q ON q.exam_id = e.id WHERE q.id = $1
        `, [question_id]);
        const courseName = courseResult.rows[0]?.name || '';

        // Save attempt
        await query(`
            INSERT INTO user_answers (user_id, question_id, selected_idx, correct_idx, is_correct, course_name)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [decoded.id, question_id, selected_idx, correctIdx, isCorrect, courseName]).catch(() => { });

        res.json({
            correct: isCorrect,
            correct_idx: correctIdx,
            explanation: q.explanation || (isCorrect ? '' : `Doğru cevap: ${correctLetter}`)
        });
    } catch (err) {
        console.error('Answer error:', err);
        res.status(500).json({ error: 'Cevap kaydedilemedi' });
    }
});

// GET /api/quiz/mistakes — wrong answers
router.get('/quiz/mistakes', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);

        const result = await query(`
            SELECT ua.question_id, ua.selected_idx, ua.correct_idx, ua.course_name, ua.answered_at,
                   q.question_text, q.options
            FROM user_answers ua
            JOIN questions q ON q.id = ua.question_id
            WHERE ua.user_id = $1 AND ua.is_correct = false
            ORDER BY ua.answered_at DESC LIMIT 50
        `, [decoded.id]);

        const mistakes = result.rows.map(m => {
            let opts = m.options;
            if (typeof opts === 'string') opts = JSON.parse(opts);
            const optArray = ['A', 'B', 'C', 'D', 'E'].filter(k => opts[k]).map(k => opts[k]);
            return {
                question_id: m.question_id,
                question_text: m.question_text,
                options: optArray,
                selected_idx: m.selected_idx,
                correct_idx: m.correct_idx,
                course_name: m.course_name,
                answered_at: m.answered_at
            };
        });
        res.json(mistakes);
    } catch (err) {
        console.error('Mistakes error:', err);
        res.json([]);
    }
});

// GET /api/quiz/mistakes/review — get wrong answers as quiz questions
router.get('/quiz/mistakes/review', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const limit = req.query.limit || 10;

        const result = await query(`
            SELECT DISTINCT ON (ua.question_id) q.id, q.question_text, q.options, q.explanation
            FROM user_answers ua JOIN questions q ON q.id = ua.question_id
            WHERE ua.user_id = $1 AND ua.is_correct = false
            ORDER BY ua.question_id, ua.answered_at DESC LIMIT $2
        `, [decoded.id, limit]);

        const formatted = result.rows.map(q => {
            let opts = q.options;
            if (typeof opts === 'string') opts = JSON.parse(opts);
            const correct = opts.correct;
            const optArray = ['A', 'B', 'C', 'D', 'E'].filter(k => opts[k]).map(k => opts[k]);
            const correctIdx = ['A', 'B', 'C', 'D', 'E'].indexOf(correct);
            return { id: q.id, question_text: q.question_text, options: optArray, correct_idx: correctIdx >= 0 ? correctIdx : 0, explanation: q.explanation || '' };
        });
        res.json(formatted);
    } catch (err) {
        console.error('Mistakes review error:', err);
        res.json([]);
    }
});

// GET /api/quiz/questions — random questions fallback
router.get('/quiz/questions', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const limit = req.query.limit || 10;

        const userResult = await query('SELECT university_id FROM users WHERE id = $1', [decoded.id]);
        const uniId = userResult.rows[0]?.university_id;

        let questions;
        if (uniId) {
            questions = await query(`
                SELECT q.id, q.question_text, q.options, q.explanation FROM questions q
                JOIN exams e ON e.id = q.exam_id JOIN courses c ON c.id = e.course_id
                JOIN departments d ON d.id = c.department_id
                WHERE d.university_id = $1 ORDER BY RANDOM() LIMIT $2
            `, [uniId, limit]);
        } else {
            questions = await query('SELECT id, question_text, options, explanation FROM questions ORDER BY RANDOM() LIMIT $1', [limit]);
        }

        const formatted = questions.rows.map(q => {
            let opts = q.options;
            if (typeof opts === 'string') opts = JSON.parse(opts);
            const correct = opts.correct;
            const optArray = ['A', 'B', 'C', 'D', 'E'].filter(k => opts[k]).map(k => opts[k]);
            const correctIdx = ['A', 'B', 'C', 'D', 'E'].indexOf(correct);
            return { id: q.id, question_text: q.question_text, options: optArray, correct_idx: correctIdx >= 0 ? correctIdx : 0, explanation: q.explanation || '' };
        });
        res.json(formatted);
    } catch (err) {
        console.error('Questions error:', err);
        res.json([]);
    }
});

// POST /api/usage/tick — track usage time
router.post('/usage/tick', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check subscription
        const subCheck = await query(`SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active' AND end_date > NOW()`, [decoded.id]);
        if (subCheck.rows.length > 0) return res.json({ unlimited: true });

        // Log usage (30 seconds per tick)
        await query(`INSERT INTO usage_log (user_id, seconds_used) VALUES ($1, 30)`, [decoded.id]).catch(() => { });

        // Check total usage today
        const usageResult = await query(`SELECT COALESCE(SUM(seconds_used), 0) as total FROM usage_log WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE`, [decoded.id]);
        const totalUsed = parseInt(usageResult.rows[0]?.total || 0);

        const settingsResult = await query("SELECT value FROM settings WHERE key = 'trial_seconds'").catch(() => ({ rows: [] }));
        const trialSeconds = parseInt(settingsResult.rows[0]?.value || 600);

        if (totalUsed >= trialSeconds) {
            return res.status(402).json({ error: 'Günlük ücretsiz kullanım süreniz doldu.' });
        }

        res.json({ used: totalUsed, remaining: trialSeconds - totalUsed });
    } catch (err) {
        console.error('Usage tick error:', err);
        res.json({ used: 0, remaining: 600 });
    }
});

// GET /api/analytics — performance stats
router.get('/analytics', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);

        const overall = await query(`
            SELECT COUNT(*) as total, SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct FROM user_answers WHERE user_id = $1
        `, [decoded.id]);
        const total = parseInt(overall.rows[0]?.total || 0);
        const correct = parseInt(overall.rows[0]?.correct || 0);
        const wrong = total - correct;
        const rate = total > 0 ? Math.round((correct / total) * 100) : 0;

        const daily = await query(`
            SELECT DATE(answered_at)::text as day, COUNT(*) as total, SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct
            FROM user_answers WHERE user_id = $1 AND answered_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(answered_at) ORDER BY DATE(answered_at)
        `, [decoded.id]);

        const perCourse = await query(`
            SELECT course_name, COUNT(*) as total, SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct
            FROM user_answers WHERE user_id = $1 GROUP BY course_name ORDER BY total DESC LIMIT 10
        `, [decoded.id]);

        res.json({
            overall: { total, correct, wrong, rate },
            daily: daily.rows,
            perCourse: perCourse.rows
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.json({ overall: { total: 0, correct: 0, wrong: 0, rate: 0 }, daily: [], perCourse: [] });
    }
});

// POST /api/user/change-password
router.post('/user/change-password', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.json({ error: 'Tüm alanları doldurun.' });
        if (newPassword.length < 6) return res.json({ error: 'Yeni şifre en az 6 karakter olmalı.' });
        const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [decoded.id]);
        if (!userResult.rows.length) return res.json({ error: 'Kullanıcı bulunamadı.' });
        const valid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
        if (!valid) return res.json({ error: 'Mevcut şifre yanlış.' });
        const newHash = await bcrypt.hash(newPassword, 10);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, decoded.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Change password error:', err);
        res.json({ error: 'Şifre değiştirilemedi.' });
    }
});

// POST /api/feedback
router.post('/feedback', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const { subject, message } = req.body;
        if (!message?.trim()) return res.json({ error: 'Mesaj boş olamaz.' });
        const userResult = await query('SELECT email, first_name, last_name FROM users WHERE id = $1', [decoded.id]);
        const user = userResult.rows[0];
        const senderName = user ? `${user.first_name} ${user.last_name}`.trim() : 'Anonim';
        const senderEmail = user?.email || '';
        await query(`INSERT INTO contact_messages (sender_name, sender_email, subject, message) VALUES ($1, $2, $3, $4)`,
            [senderName, senderEmail, subject || 'Geri Bildirim', message]);
        res.json({ success: true });
    } catch (err) {
        console.error('Feedback error:', err);
        res.json({ error: 'Geri bildirim gönderilemedi.' });
    }
});

// POST /api/payment/initialize — iyzico checkout form
router.post('/payment/initialize', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token gerekli' });
        const decoded = jwt.verify(token, JWT_SECRET);
        const Iyzipay = require('iyzipay');
        const iyzipayClient = require('../../services/iyzico');
        const crypto = require('crypto');
        const userResult = await query('SELECT id, email, first_name, last_name FROM users WHERE id = $1', [decoded.id]);
        if (!userResult.rows.length) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        const user = userResult.rows[0];
        const priceResult = await query("SELECT value FROM settings WHERE key = 'monthly_price'").catch(() => ({ rows: [] }));
        const price = priceResult.rows[0]?.value || '49.99';
        const conversationId = crypto.randomBytes(16).toString('hex');
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const request = {
            locale: Iyzipay.LOCALE.TR,
            conversationId,
            price, paidPrice: price,
            currency: Iyzipay.CURRENCY.TRY,
            basketId: 'PREMIUM_' + user.id,
            paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
            callbackUrl: `${baseUrl}/api/payment/callback`,
            enabledInstallments: [1],
            buyer: { id: String(user.id), name: user.first_name || 'User', surname: user.last_name || 'Name', gsmNumber: '+905000000000', email: user.email, identityNumber: '11111111111', lastLoginDate: '2015-10-05 12:43:35', registrationDate: '2013-04-21 15:12:09', registrationAddress: 'Istanbul', ip: req.ip || '85.34.78.112', city: 'Istanbul', country: 'Turkey', zipCode: '34732' },
            shippingAddress: { contactName: `${user.first_name} ${user.last_name}`, city: 'Istanbul', country: 'Turkey', address: 'Istanbul', zipCode: '34732' },
            billingAddress: { contactName: `${user.first_name} ${user.last_name}`, city: 'Istanbul', country: 'Turkey', address: 'Istanbul', zipCode: '34732' },
            basketItems: [{ id: 'PREMIUM', name: '1 Aylık Premium Abonelik', category1: 'Subscription', itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL, price }]
        };
        iyzipayClient.checkoutFormInitialize.create(request, (err, result) => {
            if (err || result.status !== 'success') {
                console.error('iyzico error:', err || result);
                return res.status(500).json({ error: 'Ödeme formu oluşturulamadı', details: result?.errorMessage });
            }
            res.json({ status: 'success', checkoutFormContent: result.checkoutFormContent, token: result.token });
        });
    } catch (err) {
        console.error('Payment init error:', err);
        res.status(500).json({ error: 'Ödeme başlatılamadı' });
    }
});

// POST /api/payment/callback — iyzico callback
router.post('/payment/callback', async (req, res) => {
    try {
        const paymentToken = req.body.token;
        if (!paymentToken) return res.redirect('/#status=error&message=Token_bulunamadi');
        const Iyzipay = require('iyzipay');
        const iyzipayClient = require('../../services/iyzico');
        iyzipayClient.checkoutForm.retrieve({ locale: Iyzipay.LOCALE.TR, token: paymentToken }, async (err, result) => {
            if (err || result.paymentStatus !== 'SUCCESS') {
                console.error('Payment failed:', err || result);
                return res.redirect(`/#status=error&message=${encodeURIComponent(result?.errorMessage || 'Ödeme başarısız')}`);
            }
            try {
                const userId = result.buyerId;
                // Log payment
                await query(`INSERT INTO payments (user_id, iyzi_payment_id, paid_price, currency, status) VALUES ($1, $2, $3, $4, $5)`,
                    [userId, result.paymentId, result.paidPrice, result.currency, result.paymentStatus]).catch(() => { });
                // Deactivate old subscriptions
                await query("UPDATE subscriptions SET status = 'expired' WHERE user_id = $1 AND status = 'active'", [userId]).catch(() => { });
                // Create new subscription
                await query("INSERT INTO subscriptions (user_id, plan, status, start_date, end_date) VALUES ($1, 'premium', 'active', NOW(), NOW() + INTERVAL '1 month')", [userId]);
                return res.redirect('/#status=success');
            } catch (dbErr) {
                console.error('DB Error:', dbErr);
                return res.redirect('/#status=error&message=DB_Error');
            }
        });
    } catch (err) {
        console.error('Callback error:', err);
        res.redirect('/#status=error');
    }
});

// POST /api/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.json({ error: 'E-posta gerekli.' });
        const userResult = await query('SELECT id, email FROM users WHERE email = $1', [email]);
        if (!userResult.rows.length) {
            // Don't reveal if email exists or not (security best practice)
            return res.json({ message: 'Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.' });
        }
        // Generate temporary password
        const crypto = require('crypto');
        const tempPassword = crypto.randomBytes(4).toString('hex');
        const tempHash = await bcrypt.hash(tempPassword, 10);
        await query('UPDATE users SET password_hash = $1 WHERE email = $2', [tempHash, email]);
        // In production, send email with temp password
        console.log(`[FORGOT PASSWORD] ${email} → Geçici şifre: ${tempPassword}`);
        res.json({ message: `Geçici şifre oluşturuldu. (Konsola yazdırıldı: ${tempPassword})` });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.json({ error: 'Şifre sıfırlanamadı.' });
    }
});

module.exports = router;
