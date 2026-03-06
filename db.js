const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'platform.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function migrate() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      school_key TEXT NOT NULL DEFAULT '',
      department_idx INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'user',
      google_id TEXT,
      apple_id TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'email',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      plan TEXT NOT NULL DEFAULT 'monthly',
      starts_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS daily_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      seconds_used INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_url TEXT NOT NULL DEFAULT '',
      course_name TEXT NOT NULL DEFAULT '',
      question_text TEXT NOT NULL,
      options TEXT NOT NULL DEFAULT '[]',
      correct_idx INTEGER NOT NULL DEFAULT 0,
      explanation TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      hash TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      selected_idx INTEGER NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      answered_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      payment_id TEXT UNIQUE NOT NULL,
      conversation_id TEXT NOT NULL,
      price TEXT NOT NULL,
      paid_price TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'TRY',
      status TEXT NOT NULL,
      card_brand TEXT,
      last_four_digits TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scrape_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      schools_processed INTEGER NOT NULL DEFAULT 0,
      questions_added INTEGER NOT NULL DEFAULT 0,
      questions_updated INTEGER NOT NULL DEFAULT 0,
      errors_count INTEGER NOT NULL DEFAULT 0,
      error_details TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_user_answers_user ON user_answers(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_answers_question ON user_answers(question_id);
    CREATE INDEX IF NOT EXISTS idx_questions_course ON questions(course_url);
    CREATE INDEX IF NOT EXISTS idx_questions_hash ON questions(hash);
    CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
  `);

  // Seed default settings
  const defaults = {
    trial_seconds: '600',
    monthly_price: '49.99',
    currency: 'TL',
    trial_days: '0',
    site_name: 'Açık ve Uzaktan Akademi',
    scrape_enabled: '1',
    scrape_time: '03:00'
  };

  const upsert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) {
    upsert.run(k, v);
  }

  // Create default admin if not exists
  const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      "INSERT INTO users (email, password_hash, name, school_key, department_idx, role) VALUES (?, ?, ?, ?, ?, ?)"
    ).run('admin@meddoc.com', hash, 'Admin', 'AUZEF', 0, 'admin');
    console.log('Default admin created: admin@meddoc.com / admin123');
  }

  // Seed some demo questions if none exist
  const qCount = db.prepare('SELECT COUNT(*) as c FROM questions').get().c;
  if (qCount === 0) {
    seedDemoQuestions(db);
  }

  console.log('Database migrated successfully');
}

function seedDemoQuestions(db) {
  const crypto = require('crypto');
  const fs = require('fs');

  // Try to load questions from payload.json
  const payloadPath = path.join(__dirname, 'payload.json');
  if (fs.existsSync(payloadPath)) {
    try {
      const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
      const insert = db.prepare(
        'INSERT OR IGNORE INTO questions (course_url, course_name, question_text, options, correct_idx, explanation, hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      const tx = db.transaction((items) => {
        let count = 0;
        for (const item of items) {
          const q = item.question || item.soru || '';
          const opts = item.options || item.secenekler || [];
          const correct = item.correctAnswer || item.dogruCevap || 0;
          const explain = item.explanation || item.aciklama || '';
          const course = item.course || item.ders || 'Genel';
          if (!q) continue;
          const hash = crypto.createHash('md5').update(q + JSON.stringify(opts)).digest('hex');
          insert.run('', course, q, JSON.stringify(opts), correct, explain, hash);
          count++;
        }
        return count;
      });
      const added = tx(Array.isArray(payload) ? payload : (payload.questions || []));
      console.log(`Seeded ${added} questions from payload.json`);
    } catch (e) {
      console.log('Could not seed from payload.json:', e.message);
    }
  }
}

module.exports = { getDb, migrate };
