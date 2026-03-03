const express = require('express');
const cors = require('cors');
const path = require('path');
const { migrate } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/user'));
app.use('/api', require('./routes/oauth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payment', require('./routes/payment'));

// SPA fallback
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        next();
    }
});

// Initialize DB
migrate();

// Start cron job
const { startCronJob } = require('./cron/scraper');
startCronJob();

app.listen(PORT, () => {
    console.log(`\n🚀 MedDoc Akademi Platform v2`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   Admin: admin@meddoc.com / admin123\n`);
});
