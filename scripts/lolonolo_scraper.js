/**
 * lolonolo_scraper.js — Hedef site scraper
 * 
 * Üniversite → Bölümler → Dersler → Sınav Soruları
 * Hedef: lolonolo.com/auzef, /anadolu-aof, /ataturk-aof
 * 
 * Kullanım:
 *   node scripts/lolonolo_scraper.js          → Tüm üniversiteleri tara
 *   node scripts/lolonolo_scraper.js --uni=auzef  → Sadece AUZEF
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let cheerio;
try { cheerio = require('cheerio'); } catch (e) { console.error('Cheerio gerekli: npm install cheerio'); process.exit(1); }

// ──────────── CONFIG ────────────
const TARGETS = [
    { key: 'auzef', name: 'İstanbul Üniversitesi AUZEF', url: 'https://lolonolo.com/auzef/' },
    { key: 'anadolu_aof', name: 'Anadolu Üniversitesi AÖF', url: 'https://lolonolo.com/anadolu-aof/' },
    { key: 'ataturk_aof', name: 'Atatürk Üniversitesi AÖF', url: 'https://lolonolo.com/ataturk-aof/' }
];

const DELAY_MS = 800;      // Delay between requests (rate limit)
const TIMEOUT_MS = 20000;  // Request timeout
const MAX_COURSES = 200;   // Max courses per university
const DB_PATH = path.join(__dirname, '..', 'meddoc.db');

// ──────────── HTTP HELPER ────────────
function fetchPage(url, retries = 2) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout: ${url}`)), TIMEOUT_MS);
        const client = url.startsWith('https') ? https : http;

        client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'tr-TR,tr;q=0.9'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                clearTimeout(timer);
                const redir = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : new URL(res.headers.location, url).toString();
                return fetchPage(redir, retries).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                clearTimeout(timer);
                if (retries > 0) return setTimeout(() => fetchPage(url, retries - 1).then(resolve).catch(reject), 1000);
                return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
            }
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => { clearTimeout(timer); resolve(data); });
            res.on('error', (e) => { clearTimeout(timer); reject(e); });
        }).on('error', (e) => {
            clearTimeout(timer);
            if (retries > 0) return setTimeout(() => fetchPage(url, retries - 1).then(resolve).catch(reject), 1000);
            reject(e);
        });
    });
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ──────────── STEP 1: Parse university page → department links ────────────
function parseDepartments(html, baseUrl) {
    const $ = cheerio.load(html);
    const departments = [];

    // Look for links within the article content
    $('article a, .entry-content a, .post-content a, .page-content a, main a').each((_, el) => {
        const href = $(el).attr('href');
        const name = $(el).text().trim();

        if (!href || !name) return;
        if (name.length < 3 || name.length > 120) return;

        // Filter out non-department links
        const lower = name.toLowerCase();
        if (lower.includes('indir') || lower.includes('abone') || lower.includes('uygulama') ||
            lower.includes('reklam') || lower.includes('youtube') || lower.includes('play google') ||
            lower.includes('telegram') || lower.includes('shopier') || lower.includes('takvim') ||
            lower.includes('app store') || lower.includes('üyelik')) return;

        // Must be a lolonolo link within the university section
        if (!href.includes('lolonolo.com')) return;

        // Skip if it's a blog post link (contains date patterns)
        if (/\/\d{4}\/\d{2}\//.test(href)) return;

        // Skip quiz links
        if (href.includes('wp_quiz')) return;

        departments.push({ name: name.replace(/\s+/g, ' ').trim(), url: href });
    });

    // Deduplicate by URL
    const seen = new Set();
    return departments.filter(d => {
        if (seen.has(d.url)) return false;
        seen.add(d.url);
        return true;
    });
}

// ──────────── STEP 2: Parse department page → course links ────────────
function parseCourses(html, deptUrl) {
    const $ = cheerio.load(html);
    const courses = [];
    let currentYear = '';

    // Detect year/semester markers
    $('article *, .entry-content *, .post-content *, main *').each((_, el) => {
        const tag = el.tagName?.toLowerCase();
        const text = $(el).text().trim();

        // Detect year headers like "1. Sınıf", "2. Sınıf"
        if ((tag === 'h3' || tag === 'h4' || tag === 'strong') && /^\d+\.\s*sınıf$/i.test(text)) {
            currentYear = text;
            return;
        }

        // Detect links to courses
        if (tag === 'a') {
            const href = $(el).attr('href');
            const name = $(el).text().trim();

            if (!href || !name || name.length < 3) return;

            const lower = name.toLowerCase();
            if (lower.includes('indir') || lower.includes('abone') || lower.includes('uygulama') ||
                lower.includes('reklam') || lower.includes('youtube') || lower.includes('play google') ||
                lower.includes('telegram') || lower.includes('shopier') || lower.includes('takvim') ||
                lower.includes('app store') || lower.includes('üyelik') || lower.includes('öğrenci dostu')) return;

            if (!href.includes('lolonolo.com')) return;
            if (/\/\d{4}\/\d{2}\//.test(href)) return;
            if (href.includes('wp_quiz')) return;
            if (href === deptUrl) return;

            courses.push({
                name: name.replace(/\s+/g, ' ').trim(),
                url: href,
                year: currentYear || 'Genel'
            });
        }
    });

    const seen = new Set();
    return courses.filter(c => {
        if (seen.has(c.url)) return false;
        seen.add(c.url);
        return true;
    });
}

// ──────────── STEP 3: Parse course page → exam questions ────────────
function parseQuestions(html, courseName, courseUrl) {
    const $ = cheerio.load(html);
    const questions = [];

    // Remove noise
    $('script, style, nav, footer, header, .sidebar, .widget').remove();

    const textContent = $('article, .entry-content, .post-content, main').first().html() || $('body').html();
    const $content = cheerio.load(textContent);

    // Strategy 1: Parse numbered questions with "Cevap : X)" pattern
    const fullText = $content.root().text();
    const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let currentQ = null;
    let options = [];
    let correctIdx = -1;
    let semester = detectSemester(fullText);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect semester context
        if (/güz/i.test(line)) semester = 'Güz';
        else if (/bahar/i.test(line)) semester = 'Bahar';
        else if (/bütünleme/i.test(line)) semester = 'Bütünleme';
        else if (/vize/i.test(line) && !/vizyon/i.test(line)) semester = 'Vize';
        else if (/final/i.test(line)) semester = 'Final';

        // Detect year markers like "2023-2024"
        const yearMatch = line.match(/(20\d{2})[-–](20\d{2})/);
        let examYear = '';
        if (yearMatch) examYear = yearMatch[0];

        // Question start: "1. İnsan vücudunda..." or "Soru 1:" etc.
        const qMatch = line.match(/^(?:(\d+)[\.\)]\s+)(.{15,})/);
        if (qMatch) {
            // Save previous question
            if (currentQ && options.length >= 2) {
                questions.push({
                    question_text: currentQ,
                    options: options,
                    correct_idx: Math.max(0, correctIdx),
                    semester: semester,
                    year: examYear
                });
            }
            currentQ = qMatch[2].trim();
            options = [];
            correctIdx = -1;
            continue;
        }

        // Options: "A) text" or "A. text"
        const optMatch = line.match(/^([A-Ea-e])[\.\)]\s*(.+)/);
        if (optMatch && currentQ) {
            options.push(optMatch[2].trim());
            continue;
        }

        // Multi-option on same line: "A) ... B) ... C) ... D) ... E) ..."
        if (currentQ && /^[A-E]\)/.test(line)) {
            const parts = line.match(/([A-E]\)\s*[^A-E\)]+)/g);
            if (parts && parts.length >= 3) {
                options = parts.map(p => p.replace(/^[A-E]\)\s*/, '').trim());
                continue;
            }
        }

        // Answer line: "Cevap : C) Uzun kemikler" or "Cevap: B"
        const ansMatch = line.match(/Cevap\s*:\s*(?:([A-Ea-e])[\.\)]|.*?([A-Ea-e])\s*\))/i);
        if (ansMatch && currentQ) {
            const letter = (ansMatch[1] || ansMatch[2] || '').toUpperCase();
            if (letter) correctIdx = letter.charCodeAt(0) - 65;
        }

        // Simple answer: just "Cevap : E) Perikard"
        const simpleAns = line.match(/^Cevap\s*:\s*([A-Ea-e])/i);
        if (simpleAns && currentQ) {
            correctIdx = simpleAns[1].toUpperCase().charCodeAt(0) - 65;
        }

        // Question continuation (no option letter, not too long)
        if (currentQ && options.length === 0 && !line.match(/^[A-E][\.\)]/) &&
            !line.match(/^Cevap/i) && line.length > 5 && line.length < 300 &&
            !line.match(/^\d+[\.\)]/)) {
            currentQ += ' ' + line;
        }
    }

    // Push last question
    if (currentQ && options.length >= 2) {
        questions.push({
            question_text: currentQ,
            options: options,
            correct_idx: Math.max(0, correctIdx),
            semester: semester,
            year: ''
        });
    }

    // Also extract sub-page links (unit tests, yearly exams)
    const examLinks = [];
    $content('a').each((_, el) => {
        const href = $content(el).attr('href');
        const text = $content(el).text().trim();
        if (!href || !text) return;
        if (!href.includes('lolonolo.com')) return;
        if (href === courseUrl) return;

        // Links to tests, quizzes, or year-specific pages
        if (/(?:test|sınav|soru|ünite|unite|quiz)/i.test(text) || href.includes('wp_quiz')) {
            examLinks.push({ text, url: href });
        }
    });

    return { questions, examLinks };
}

function detectSemester(text) {
    if (/bütünleme/i.test(text)) return 'Bütünleme';
    if (/güz.*final/i.test(text)) return 'Güz Final';
    if (/bahar.*final/i.test(text)) return 'Bahar Final';
    if (/güz.*vize/i.test(text)) return 'Güz Vize';
    if (/bahar.*vize/i.test(text)) return 'Bahar Vize';
    if (/güz/i.test(text)) return 'Güz';
    if (/bahar/i.test(text)) return 'Bahar';
    return '';
}

// ──────────── DATABASE ────────────
function getDatabase() {
    const Database = require('better-sqlite3');
    return new Database(DB_PATH);
}

function upsertQuestion(db, upsertStmt, courseUrl, courseName, q) {
    const hash = crypto.createHash('md5')
        .update(q.question_text + JSON.stringify(q.options))
        .digest('hex');

    const fullCourseName = q.semester
        ? `${courseName} (${q.semester}${q.year ? ' ' + q.year : ''})`
        : courseName;

    try {
        return upsertStmt.run(
            courseUrl,
            fullCourseName,
            q.question_text,
            JSON.stringify(q.options),
            q.correct_idx,
            '',
            courseUrl,
            hash
        );
    } catch (e) {
        return null; // duplicate
    }
}

// ──────────── MAIN SCRAPER ────────────
async function scrapeUniversity(target, db, upsertStmt, logFn) {
    logFn(`\n${'═'.repeat(60)}`);
    logFn(`🏫 ${target.name}`);
    logFn(`   ${target.url}`);
    logFn('═'.repeat(60));

    const stats = { departments: 0, courses: 0, questions: 0, errors: 0, errorDetails: [] };

    // Step 1: Get department list
    let deptHtml;
    try {
        deptHtml = await fetchPage(target.url);
    } catch (e) {
        logFn(`❌ Üniversite sayfası alınamadı: ${e.message}`);
        stats.errors++;
        stats.errorDetails.push(`${target.key}: ${e.message}`);
        return stats;
    }

    const departments = parseDepartments(deptHtml, target.url);
    logFn(`📋 ${departments.length} bölüm bulundu`);

    // For school_data.json
    const schoolData = {
        name: target.name,
        departments: []
    };

    for (const dept of departments) {
        await delay(DELAY_MS);
        stats.departments++;

        logFn(`\n  📁 ${dept.name}`);

        let deptPageHtml;
        try {
            deptPageHtml = await fetchPage(dept.url);
        } catch (e) {
            logFn(`     ❌ Sayfa alınamadı: ${e.message}`);
            stats.errors++;
            stats.errorDetails.push(`${dept.name}: ${e.message}`);
            continue;
        }

        const courses = parseCourses(deptPageHtml, dept.url);
        logFn(`     📚 ${courses.length} ders bulundu`);

        const deptEntry = {
            name: dept.name,
            url: dept.url,
            courses: []
        };

        // Limit courses
        const coursesToProcess = courses.slice(0, MAX_COURSES);

        for (const course of coursesToProcess) {
            await delay(DELAY_MS);

            try {
                const courseHtml = await fetchPage(course.url);
                const { questions, examLinks } = parseQuestions(courseHtml, course.name, course.url);
                stats.courses++;

                let courseQCount = questions.length;

                // Save questions to database
                for (const q of questions) {
                    const result = upsertQuestion(db, upsertStmt, course.url, course.name, q);
                    if (result && result.changes > 0) stats.questions++;
                }

                // Also scrape linked exam pages (limited to 3 per course)
                const linksToScrape = examLinks.slice(0, 3);
                for (const link of linksToScrape) {
                    await delay(DELAY_MS);
                    try {
                        const linkHtml = await fetchPage(link.url);
                        const linkResult = parseQuestions(linkHtml, course.name, link.url);
                        for (const q of linkResult.questions) {
                            const result = upsertQuestion(db, upsertStmt, course.url, course.name, q);
                            if (result && result.changes > 0) stats.questions++;
                        }
                        courseQCount += linkResult.questions.length;
                    } catch (e) {
                        // silently skip failed sub-pages
                    }
                }

                if (courseQCount > 0) {
                    logFn(`       ✅ ${course.name}: ${courseQCount} soru (${course.year})`);
                }

                deptEntry.courses.push({
                    name: course.name,
                    url: course.url,
                    year: course.year
                });

            } catch (e) {
                stats.errors++;
                const msg = `${course.name}: ${e.message}`;
                stats.errorDetails.push(msg);
                logFn(`       ❌ ${msg}`);
            }
        }

        schoolData.departments.push(deptEntry);
    }

    return { stats, schoolData };
}

async function runFullScrape(filterUni = null) {
    const db = getDatabase();
    const logLines = [];
    const logFn = (msg) => { console.log(msg); logLines.push(msg); };

    logFn(`\n🚀 Lolonolo Scraper başlatılıyor — ${new Date().toISOString()}\n`);

    // Create log entry
    const logEntry = db.prepare("INSERT INTO scrape_logs (status) VALUES ('running')").run();
    const logId = logEntry.lastInsertRowid;

    const upsertStmt = db.prepare(
        `INSERT INTO questions (course_url, course_name, question_text, options, correct_idx, explanation, source_url, hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(hash) DO UPDATE SET
           course_name = excluded.course_name,
           options = excluded.options,
           correct_idx = excluded.correct_idx`
    );

    const allSchoolData = {};
    let totalStats = { departments: 0, courses: 0, questions: 0, errors: 0, errorDetails: [] };

    const targets = filterUni
        ? TARGETS.filter(t => t.key === filterUni)
        : TARGETS;

    for (const target of targets) {
        try {
            const { stats, schoolData } = await scrapeUniversity(target, db, upsertStmt, logFn);
            allSchoolData[target.key] = schoolData;
            totalStats.departments += stats.departments;
            totalStats.courses += stats.courses;
            totalStats.questions += stats.questions;
            totalStats.errors += stats.errors;
            totalStats.errorDetails.push(...stats.errorDetails);
        } catch (e) {
            logFn(`\n❌ Fatal error for ${target.name}: ${e.message}`);
            totalStats.errors++;
            totalStats.errorDetails.push(`FATAL ${target.key}: ${e.message}`);
        }
    }

    // Save school_data.json
    const dataPath = path.join(__dirname, '..', 'school_data.json');
    try {
        // Load existing data and merge
        let existing = {};
        if (fs.existsSync(dataPath)) {
            try { existing = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (e) { }
        }
        const merged = { ...existing, ...allSchoolData };
        fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2), 'utf8');
        logFn(`\n📁 school_data.json güncellendi (${Object.keys(merged).length} üniversite)`);
    } catch (e) {
        logFn(`\n❌ school_data.json yazılamadı: ${e.message}`);
    }

    // Summary
    logFn(`\n${'═'.repeat(60)}`);
    logFn(`📊 ÖZET`);
    logFn(`   Bölümler: ${totalStats.departments}`);
    logFn(`   Dersler:  ${totalStats.courses}`);
    logFn(`   Sorular:  ${totalStats.questions} (veritabanına eklendi)`);
    logFn(`   Hatalar:  ${totalStats.errors}`);
    logFn('═'.repeat(60));

    // Update log entry
    let finalStatus = 'success';
    if (totalStats.errors > 0 && totalStats.questions === 0) finalStatus = 'failed';
    else if (totalStats.errors > 0) finalStatus = 'completed_with_errors';

    db.prepare(
        `UPDATE scrape_logs SET
            finished_at = datetime('now'),
            status = ?,
            schools_processed = ?,
            questions_added = ?,
            questions_updated = 0,
            errors_count = ?,
            error_details = ?
         WHERE id = ?`
    ).run(
        finalStatus,
        totalStats.departments,
        totalStats.questions,
        totalStats.errors,
        totalStats.errorDetails.slice(0, 50).join('\n'),
        logId
    );

    db.close();
    logFn(`\n✅ Tamamlandı — ${new Date().toISOString()}`);
    return totalStats;
}

// ──────────── CLI ENTRY ────────────
if (require.main === module) {
    const args = process.argv.slice(2);
    let filterUni = null;

    for (const arg of args) {
        if (arg.startsWith('--uni=')) filterUni = arg.split('=')[1];
    }

    runFullScrape(filterUni)
        .then(stats => {
            console.log(`\nÇıkış — ${stats.questions} soru eklendi, ${stats.errors} hata`);
            process.exit(0);
        })
        .catch(e => {
            console.error('Fatal error:', e);
            process.exit(1);
        });
}

module.exports = { runFullScrape, scrapeUniversity, parseQuestions, parseDepartments, parseCourses };
