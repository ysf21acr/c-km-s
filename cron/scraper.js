const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { getDb } = require('../db');

// ──────────── HTTP FETCH ────────────

function fetchPage(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout: ${url}`)), timeout);
        const client = url.startsWith('https') ? https : http;

        client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
            }
        }, (res) => {
            // Follow redirects (up to 5)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                clearTimeout(timer);
                const redirectUrl = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : new URL(res.headers.location, url).toString();
                return fetchPage(redirectUrl, timeout).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                clearTimeout(timer);
                return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => { clearTimeout(timer); resolve(data); });
            res.on('error', (e) => { clearTimeout(timer); reject(e); });
        }).on('error', (e) => { clearTimeout(timer); reject(e); });
    });
}

// ──────────── CHEERIO-BASED QUESTION EXTRACTION ────────────

function extractQuestionsFromHtml(html) {
    let cheerio;
    try {
        cheerio = require('cheerio');
    } catch (e) {
        // Fallback to regex if cheerio not available
        return extractQuestionsRegex(html);
    }

    const $ = cheerio.load(html);
    const questions = [];

    // Strategy 1: Look for structured quiz/question blocks
    // Common patterns in Turkish educational sites
    $('div, article, section').each((_, container) => {
        const text = $(container).text();
        // Check if this container looks like it has questions
        if (/Soru\s*\d+|S\.\s*\d+|\d+[\.\)]\s+.{20,}/i.test(text)) {
            // Don't process too-large containers (entire page body etc.)
            if (text.length > 50000) return;
        }
    });

    // Strategy 2: Parse text content line by line using Cheerio-cleaned text
    // Remove scripts, styles, nav elements
    $('script, style, nav, footer, header, .sidebar, .menu, .navigation').remove();

    const textContent = $('body').text();
    const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let currentQ = null;
    let options = [];
    let correctAnswer = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect question start patterns
        const qMatch = line.match(/^(?:Soru\s*(\d+)[\.:]\s*|S\.\s*(\d+)[\.:]\s*|(\d+)[\.\)]\s+)(.+)/i);
        if (qMatch && (qMatch[4] || '').length > 15) {
            // Save previous question
            if (currentQ && options.length >= 3) {
                questions.push({
                    question: currentQ.trim(),
                    options: [...options],
                    correct: Math.max(0, correctAnswer)
                });
            }
            currentQ = qMatch[4];
            options = [];
            correctAnswer = -1;
            continue;
        }

        // Detect multi-line question continuation (no option letter at start)
        if (currentQ && options.length === 0 && !line.match(/^[A-Ea-e][\.\)]\s/) && line.length > 10 && line.length < 300) {
            // Could be continuation of question text
            if (!line.match(/^(?:Soru|Cevap|Yanıt|Doğru|Açıklama)/i)) {
                currentQ += ' ' + line;
                continue;
            }
        }

        // Detect options (A), B), C), D), E) or A., B., C., D., E.)
        const optMatch = line.match(/^([A-Ea-e])[\.\)]\s*(.+)/);
        if (optMatch && currentQ) {
            options.push(optMatch[2].trim());

            // Check for correct answer indicators
            if (line.includes('✓') || line.includes('✔') || line.includes('(Doğru)') || line.includes('***')) {
                correctAnswer = options.length - 1;
            }
        }

        // Detect answer key patterns: "Cevap: C", "Doğru Cevap: B", "Yanıt: A"
        const ansMatch = line.match(/(?:Cevap|Doğru\s*Cevap|Yanıt)\s*[:=]\s*([A-Ea-e])/i);
        if (ansMatch && currentQ) {
            correctAnswer = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
        }
    }

    // Push last question
    if (currentQ && options.length >= 3) {
        questions.push({
            question: currentQ.trim(),
            options: [...options],
            correct: Math.max(0, correctAnswer)
        });
    }

    // Strategy 3: Look for HTML tables with questions (common in some sites)
    $('table').each((_, table) => {
        const rows = $(table).find('tr');
        let tableQ = null;
        let tableOpts = [];

        rows.each((_, row) => {
            const cells = $(row).find('td, th');
            const rowText = $(row).text().trim();

            const qMatch = rowText.match(/^(?:Soru\s*\d+[\.:]\s*|S\.\s*\d+[\.:]\s*|\d+[\.\)]\s+)(.{15,})/i);
            if (qMatch) {
                if (tableQ && tableOpts.length >= 3) {
                    questions.push({ question: tableQ.trim(), options: [...tableOpts], correct: 0 });
                }
                tableQ = qMatch[1];
                tableOpts = [];
                return;
            }

            const optMatch = rowText.match(/^([A-Ea-e])[\.\)]\s*(.+)/);
            if (optMatch && tableQ) {
                tableOpts.push(optMatch[2].trim());
            }
        });

        if (tableQ && tableOpts.length >= 3) {
            questions.push({ question: tableQ.trim(), options: [...tableOpts], correct: 0 });
        }
    });

    return questions;
}

// Regex fallback (original logic)
function extractQuestionsRegex(html) {
    const questions = [];
    const text = html.replace(/<[^>]+>/g, '\n');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let currentQ = null;
    let options = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const qMatch = line.match(/^(?:Soru\s*\d+[\.:]\s*|S\.\s*\d+[\.:]\s*|\d+[\.\)]\s+)(.+)/i);
        if (qMatch && qMatch[1].length > 20) {
            if (currentQ && options.length >= 3) {
                questions.push({ question: currentQ, options: [...options], correct: 0 });
            }
            currentQ = qMatch[1];
            options = [];
            continue;
        }
        const optMatch = line.match(/^([A-Ea-e])[\.\)]\s*(.+)/);
        if (optMatch && currentQ) {
            options.push(optMatch[2]);
        }
    }
    if (currentQ && options.length >= 3) {
        questions.push({ question: currentQ, options: [...options], correct: 0 });
    }
    return questions;
}

// ──────────── MAIN SCRAPER ────────────

async function runScraper() {
    const db = getDb();
    const fs = require('fs');
    const path = require('path');

    // Create log entry
    const log = db.prepare("INSERT INTO scrape_logs (status) VALUES ('running')").run();
    const logId = log.lastInsertRowid;
    let questionsAdded = 0;
    let questionsUpdated = 0;
    let schoolsProcessed = 0;
    let errorsCount = 0;
    let errorDetails = [];

    console.log(`[CRON] Scrape started at ${new Date().toISOString()}`);

    try {
        const dataPath = path.join(__dirname, '..', 'school_data.json');
        if (!fs.existsSync(dataPath)) {
            throw new Error('school_data.json bulunamadı');
        }

        const schoolData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        const upsertQ = db.prepare(
            `INSERT INTO questions (course_url, course_name, question_text, options, correct_idx, explanation, source_url, hash)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(hash) DO UPDATE SET
               course_name = excluded.course_name,
               options = excluded.options,
               correct_idx = excluded.correct_idx`
        );

        for (const [schoolKey, school] of Object.entries(schoolData)) {
            schoolsProcessed++;
            console.log(`[CRON] Processing: ${school.name} (${school.departments.length} departments)`);

            for (const dept of school.departments) {
                // Limit courses per department to avoid overloading
                const coursesToScrape = dept.courses.slice(0, 5);

                for (const course of coursesToScrape) {
                    try {
                        const html = await fetchPage(course.url);
                        const questions = extractQuestionsFromHtml(html);

                        for (const q of questions) {
                            // Generate unique hash from question text + options
                            const hash = crypto
                                .createHash('md5')
                                .update(q.question + JSON.stringify(q.options))
                                .digest('hex');

                            try {
                                const result = upsertQ.run(
                                    course.url,
                                    course.name,
                                    q.question,
                                    JSON.stringify(q.options),
                                    q.correct,
                                    '',
                                    course.url,
                                    hash
                                );

                                if (result.changes > 0) {
                                    if (result.lastInsertRowid) questionsAdded++;
                                    else questionsUpdated++;
                                }
                            } catch (e) {
                                // Duplicate hash — skip silently
                            }
                        }

                        if (questions.length > 0) {
                            console.log(`[CRON]   ${course.name}: ${questions.length} soru bulundu`);
                        }

                        // Rate limiting — 500ms between requests
                        await new Promise(r => setTimeout(r, 500));
                    } catch (err) {
                        errorsCount++;
                        const errMsg = `${schoolKey}/${course.name}: ${err.message}`;
                        errorDetails.push(errMsg);
                        console.error(`[CRON] Error: ${errMsg}`);
                    }
                }
            }
        }
    } catch (err) {
        errorsCount++;
        errorDetails.push(`Fatal: ${err.message}`);
        console.error(`[CRON] Fatal error: ${err.message}`);
    }

    // Determine final status
    let finalStatus = 'success';
    if (errorsCount > 0 && questionsAdded === 0 && questionsUpdated === 0) {
        finalStatus = 'failed';
    } else if (errorsCount > 0) {
        finalStatus = 'completed_with_errors';
    }

    // Update log entry
    db.prepare(
        `UPDATE scrape_logs SET
            finished_at = datetime('now'),
            status = ?,
            schools_processed = ?,
            questions_added = ?,
            questions_updated = ?,
            errors_count = ?,
            error_details = ?
         WHERE id = ?`
    ).run(
        finalStatus,
        schoolsProcessed,
        questionsAdded,
        questionsUpdated,
        errorsCount,
        errorDetails.slice(0, 30).join('\n'),
        logId
    );

    console.log(`[CRON] Scrape finished: status=${finalStatus}, +${questionsAdded} new, ~${questionsUpdated} updated, ${errorsCount} errors`);
    return { questionsAdded, questionsUpdated, errorsCount, finalStatus };
}

// ──────────── CRON SCHEDULER ────────────

function startCronJob() {
    const cron = require('node-cron');
    const { getDb } = require('../db');

    // Read scrape time from settings (default: 03:00)
    let scrapeTime = '03:00';
    try {
        const db = getDb();
        const setting = db.prepare("SELECT value FROM settings WHERE key = 'scrape_time'").get();
        if (setting) scrapeTime = setting.value;
    } catch (e) { /* use default */ }

    const [hour, minute] = scrapeTime.split(':').map(Number);

    // Schedule: every night at configured time
    cron.schedule(`${minute} ${hour} * * *`, async () => {
        // Check if scraping is enabled
        try {
            const db = getDb();
            const enabled = db.prepare("SELECT value FROM settings WHERE key = 'scrape_enabled'").get();
            if (enabled && enabled.value === '0') {
                console.log('[CRON] Scraping disabled in settings, skipping...');
                return;
            }
        } catch (e) { /* proceed anyway */ }

        console.log('[CRON] Starting nightly scrape...');

        // Run lolonolo.com targeted scraper
        try {
            const { runFullScrape } = require('../scripts/lolonolo_scraper');
            console.log('[CRON] Running lolonolo.com scraper...');
            await runFullScrape();
        } catch (e) {
            console.error('[CRON] Lolonolo scraper error:', e.message);
        }

        // Also run generic scraper as fallback
        try {
            await runScraper();
        } catch (e) {
            console.error('[CRON] Generic scraper error:', e.message);
        }
    });

    console.log(`Cron job scheduled: nightly at ${scrapeTime}`);
}

// Run lolonolo scraper on-demand (for admin panel)
async function runLolonolo() {
    try {
        const { runFullScrape } = require('../scripts/lolonolo_scraper');
        return await runFullScrape();
    } catch (e) {
        console.error('Lolonolo scraper error:', e.message);
        throw e;
    }
}

module.exports = { runScraper, startCronJob, runLolonolo };
