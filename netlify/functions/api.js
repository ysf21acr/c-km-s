const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const { migrateV2 } = require('../../db-v2');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/v1/auth', require('../../routes/v2/auth'));
app.use('/api/v1/subscription', require('../../routes/v2/subscription'));
app.use('/api/v1/study', require('../../routes/v2/study'));
app.use('/api/v1/admin', require('../../routes/v2/admin'));

// Compatibility routes for existing frontend
app.use('/api', require('../../routes/v2/compat'));

// Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Sunucu hatası.' });
});

// Run migration on cold start
let migrated = false;
const handler = serverless(app);

module.exports.handler = async (event, context) => {
    if (!migrated) {
        try {
            await migrateV2();
            migrated = true;
        } catch (e) {
            console.error('Migration error:', e.message);
        }
    }
    return handler(event, context);
};
