require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { migrateV2, query } = require('./db-v2');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://sandbox-api.iyzipay.com", "https://api.iyzipay.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://sandbox-api.iyzipay.com", "https://api.iyzipay.com"],
            frameSrc: ["'self'", "https://sandbox-api.iyzipay.com", "https://api.iyzipay.com"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Çok fazla istek. Lütfen bekleyin.' } }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: { error: 'Çok fazla giriş denemesi.' } }));
app.use('/api/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Çok fazla kayıt denemesi.' } }));

let maintenanceCache = { value: false, checkedAt: 0 };
app.use(async (req, res, next) => {
    try {
        if (req.path.startsWith('/admin') || req.path.startsWith('/api/v1/admin')) return next();
        const now = Date.now();
        if (now - maintenanceCache.checkedAt > 30000) {
            const r = await query("SELECT value FROM settings WHERE key = 'maintenance_mode'").catch(() => ({ rows: [] }));
            maintenanceCache = {
                value: String(r.rows[0]?.value || 'false').toLowerCase() === 'true',
                checkedAt: now
            };
        }
        if (!maintenanceCache.value) return next();
        if (req.path.startsWith('/api/')) {
            return res.status(503).json({ error: 'Sistem bakım modunda. Lütfen daha sonra tekrar deneyin.' });
        }
        return res.status(503).send('Sistem bakım modunda. Lütfen daha sonra tekrar deneyin.');
    } catch (err) {
        return next();
    }
});

const publicDir = path.join(__dirname, 'public');

app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(express.static(publicDir));

app.use('/api/v1/auth', require('./routes/v2/auth'));
app.use('/api/v1/subscription', require('./routes/v2/subscription'));
app.use('/api/v1/study', require('./routes/v2/study'));
app.use('/api/v1/admin', require('./routes/v2/admin'));
app.use('/api', require('./routes/v2/compat'));

app.use('/admin', (req, res, next) => {
    if (req.path.includes('.')) return next();
    res.sendFile(path.join(publicDir, 'admin', 'index.html'));
});

app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/admin')) {
        return res.sendFile(path.join(publicDir, 'index.html'));
    }
    return next();
});

app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Sunucu hatası.' });
});

async function start() {
    try {
        await migrateV2();
        // Start subscription cron job
        const { startSubscriptionCron } = require('./cron/subscription');
        startSubscriptionCron();
        app.listen(PORT, () => {
            console.log(`\n🚀 Açık ve Uzaktan Akademi V2`);
            console.log(`   http://localhost:${PORT}\n`);
        });
    } catch (e) {
        console.error('Başlatma hatası:', e);
        process.exit(1);
    }
}

start();
