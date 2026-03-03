const express = require('express');
const router = express.Router();
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../db-v2');
const { validate } = require('../../middleware/v2/validate');
const { JWT_SECRET, JWT_REFRESH_SECRET } = require('../../middleware/v2/auth');

// Validation Schemas
const registerSchema = z.object({
    body: z.object({
        email: z.string().email('Geçerli bir e-posta adresi girin'),
        password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
        first_name: z.string().min(2, 'Ad en az 2 karakter olmalıdır'),
        last_name: z.string().min(2, 'Soyad en az 2 karakter olmalıdır')
    })
});

const loginSchema = z.object({
    body: z.object({
        email: z.string().email('Geçerli bir e-posta adresi girin'),
        password: z.string().min(6, 'Geçerli bir şifre girin')
    })
});

const refreshSchema = z.object({
    body: z.object({
        refreshToken: z.string().min(1, 'Refresh token gerekli')
    })
});

// Helpers
function generateTokens(user) {
    const accessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
        { id: user.id },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
    return { accessToken, refreshToken };
}

// Routes
router.post('/register', validate(registerSchema), async (req, res) => {
    try {
        const { email, password, first_name, last_name } = req.body;

        const checkUser = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ error: 'Bu e-posta adresiyle kayıtlı bir hesap zaten var.' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const result = await query(`
            INSERT INTO users (email, password_hash, first_name, last_name)
            VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, role
        `, [email, password_hash, first_name, last_name]);

        const newUser = result.rows[0];
        const { accessToken, refreshToken } = generateTokens(newUser);

        // Store refresh token
        await query(`
            INSERT INTO refresh_tokens (user_id, token, expires_at)
            VALUES ($1, $2, NOW() + INTERVAL '7 days')
        `, [newUser.id, refreshToken]);

        res.status(201).json({
            message: 'Kayıt başarılı',
            accessToken,
            refreshToken,
            user: newUser
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu' });
    }
});

router.post('/login', validate(loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Hesabınız askıya alınmış.' });
        }

        const { accessToken, refreshToken } = generateTokens(user);

        // Store refresh token
        await query(`
            INSERT INTO refresh_tokens (user_id, token, expires_at)
            VALUES ($1, $2, NOW() + INTERVAL '7 days')
        `, [user.id, refreshToken]);

        // Update last login
        await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        // remove password before sending response
        delete user.password_hash;

        res.status(200).json({ accessToken, refreshToken, user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Giriş sırasında bir hata oluştu' });
    }
});

router.post('/refresh', validate(refreshSchema), async (req, res) => {
    const { refreshToken } = req.body;
    try {
        const tokenData = await query('SELECT user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()', [refreshToken]);
        if (tokenData.rows.length === 0) {
            return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş refresh token.' });
        }

        const user_id = tokenData.rows[0].user_id;

        jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
            if (err) return res.status(403).json({ error: 'Geçersiz refresh token.' });

            const userResult = await query('SELECT id, email, role FROM users WHERE id = $1', [user_id]);
            const user = userResult.rows[0];

            if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

            const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user);

            // Replace token in DB
            await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
            await query(`
                INSERT INTO refresh_tokens (user_id, token, expires_at)
                VALUES ($1, $2, NOW() + INTERVAL '7 days')
            `, [user.id, newRefreshToken]);

            res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
        });
    } catch (err) {
        console.error('Refresh token error:', err);
        res.status(500).json({ error: 'Token yenileme sırasında bir hata oluştu.' });
    }
});

module.exports = router;
