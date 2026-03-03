const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
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
            console.log('PostgreSQL migration completed successfully.');
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
