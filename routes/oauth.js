const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/google — Google OAuth login/register
router.post('/auth/google', async (req, res) => {
    const { credential, school_key, department_idx } = req.body;

    if (!credential) return res.status(400).json({ error: 'Google credential gerekli' });

    try {
        // Decode Google JWT (simple decode, production should verify with Google's public keys)
        const parts = credential.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

        const { sub: googleId, email, name, picture } = payload;

        if (!email) return res.status(400).json({ error: 'Google hesabında e-posta bulunamadı' });

        const db = getDb();

        // Check if user already exists
        let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(googleId, email);

        if (user) {
            // Existing user — update google_id if needed
            if (!user.google_id) {
                db.prepare('UPDATE users SET google_id = ?, auth_provider = ? WHERE id = ?').run(googleId, 'google', user.id);
            }
        } else {
            // New user — needs school/department
            if (!school_key || department_idx === undefined) {
                return res.status(400).json({ error: 'needs_registration', message: 'Okul ve bölüm seçimi gerekli', email, name });
            }

            const result = db.prepare(
                "INSERT INTO users (email, password_hash, name, school_key, department_idx, google_id, auth_provider) VALUES (?, '', ?, ?, ?, ?, 'google')"
            ).run(email, name || '', school_key, department_idx, googleId);

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name, school_key: user.school_key, department_idx: user.department_idx, role: user.role }
        });
    } catch (err) {
        console.error('Google OAuth error:', err);
        res.status(500).json({ error: 'Google girişi başarısız' });
    }
});

// POST /api/auth/apple — Apple Sign In login/register
router.post('/auth/apple', async (req, res) => {
    const { identity_token, user_name, school_key, department_idx } = req.body;

    if (!identity_token) return res.status(400).json({ error: 'Apple identity token gerekli' });

    try {
        // Decode Apple identity token JWT
        // In production, verify with Apple's public keys from https://appleid.apple.com/auth/keys
        const parts = identity_token.split('.');
        if (parts.length !== 3) return res.status(400).json({ error: 'Geçersiz Apple token formatı' });

        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        const { sub: appleId, email } = payload;

        if (!appleId) return res.status(400).json({ error: 'Apple kimliği bulunamadı' });

        const db = getDb();

        // Ensure apple_id column exists (safe migration)
        try { db.exec('ALTER TABLE users ADD COLUMN apple_id TEXT'); } catch (e) { /* column already exists */ }

        // Check if user already exists
        let user = db.prepare('SELECT * FROM users WHERE apple_id = ? OR (email = ? AND email IS NOT NULL AND email != ?)').get(appleId, email || '', '');

        if (user) {
            // Existing user — update apple_id if needed
            if (!user.apple_id) {
                db.prepare('UPDATE users SET apple_id = ?, auth_provider = ? WHERE id = ?').run(appleId, 'apple', user.id);
            }
        } else {
            // New user — needs school/department
            if (!school_key || department_idx === undefined) {
                return res.status(400).json({
                    error: 'needs_registration',
                    message: 'Okul ve bölüm seçimi gerekli',
                    email: email || '',
                    name: user_name || ''
                });
            }

            // Apple only sends the user's name on the FIRST authorization
            const name = user_name || '';

            const result = db.prepare(
                "INSERT INTO users (email, password_hash, name, school_key, department_idx, apple_id, auth_provider) VALUES (?, '', ?, ?, ?, ?, 'apple')"
            ).run(email || `apple_${appleId}@private.relay`, name, school_key, department_idx, appleId);

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                school_key: user.school_key,
                department_idx: user.department_idx,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Apple OAuth error:', err);
        res.status(500).json({ error: 'Apple girişi başarısız' });
    }
});

module.exports = router;
