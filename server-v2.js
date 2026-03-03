require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { migrateV2 } = require('./db-v2');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Security
const helmet = require('helmet');
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

const rateLimit = require('express-rate-limit');
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Çok fazla istek. Lütfen bekleyin.' } }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: { error: 'Çok fazla giriş denemesi.' } }));
app.use('/api/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Çok fazla kayıt denemesi.' } }));

// Static files — explicit root route + static middleware
const publicDir = path.join(__dirname, 'public');

app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(express.static(publicDir));

// API Routes
app.use('/api/v1/auth', require('./routes/v2/auth'));
app.use('/api/v1/subscription', require('./routes/v2/subscription'));
app.use('/api/v1/study', require('./routes/v2/study'));
app.use('/api/v1/admin', require('./routes/v2/admin'));

// Compatibility routes for existing frontend (old API paths)
app.use('/api', require('./routes/v2/compat'));

// Admin Panel SPA Fallback (React Router)
app.use('/admin', (req, res, next) => {
    // Let static files through (css, js, etc.)
    if (req.path.includes('.')) return next();
    res.sendFile(path.join(publicDir, 'admin', 'index.html'));
});

// Main Site SPA Fallback
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/admin')) {
        res.sendFile(path.join(publicDir, 'index.html'));
    } else {
        next();
    }
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Sunucu hatası.' });
});

// Start
async function start() {
    try {
        await migrateV2();
        app.listen(PORT, () => {
            console.log(`\n🚀 MedDoc Akademi V2`);
            console.log(`   http://localhost:${PORT}\n`);
        });
    } catch (e) {
        console.error('Başlatma hatası:', e);
        process.exit(1);
    }
}

start();
