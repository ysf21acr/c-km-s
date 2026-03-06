const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Create a unified pool
const isProduction = process.env.NODE_ENV === 'production';
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/meddoc',
    ssl: isProduction ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle pg client', err);
});

async function query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
}

// Function to run the schema definitions (Migrations)
async function migrateV2() {
    const client = await pool.connect();
    try {
        console.log('Starting PostgreSQL migration...');
        // Execute schema initialization
        const schemaPath = path.join(__dirname, 'schema-v2.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            await client.query(schemaSql);
            await client.query(`
                INSERT INTO settings (key, value) VALUES
                ('site_name', 'Açık ve Uzaktan Akademi'),
                ('monthly_price', '49.99'),
                ('trial_seconds', '600'),
                ('registration_enabled', 'true'),
                ('maintenance_mode', 'false')
                ON CONFLICT (key) DO NOTHING
            `);

            await client.query(`
                INSERT INTO subscription_plans (name, monthly_price, daily_free_minutes, is_active)
                SELECT 'Premium', 49.99, 10, true
                WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Premium')
            `);

            const adminExists = await client.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
            if (adminExists.rows.length === 0) {
                const hash = await bcrypt.hash('admin123', 10);
                await client.query(`
                    INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
                    VALUES ($1, $2, $3, $4, 'admin', true)
                `, ['admin@meddoc.com', hash, 'Admin', 'User']);
            }
            console.log('PostgreSQL migration completed successfully.');

            // Add new columns to subscriptions table if they don't exist (for existing DBs)
            await client.query(`
                ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true;
                ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
            `).catch(() => { });
        } else {
            console.warn('schema-v2.sql not found, skipping migration.');
        }
    } catch (err) {
        console.error('Migration failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    query,
    pool,
    migrateV2
};
