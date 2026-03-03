/**
 * MedDoc — Lolonolo Full Scraper
 * Scrapes: University → Departments → Courses (by class year) → Exam Questions
 * Saves to PostgreSQL database with upsert logic
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { query, migrateV2 } = require('./db-v2');

// ==================== CONFIGURATION ====================
const DELAY_MS = 400;           // delay between requests (be nice to server)
const BATCH_SIZE = 3;           // concurrent requests per batch
const FILTER_SCHOOL = null;     // set to 'AUZEF', 'ANADOLU_AOF', or 'ATATURK_AOF' to scrape only one

// ==================== SCHOOL DATA ====================
const schools = {
    AUZEF: { name: 'İstanbul Üniversitesi AUZEF', slug: 'auzef', url: 'https://lolonolo.com/auzef/' },
    ANADOLU_AOF: { name: 'Anadolu Üniversitesi AÖF', slug: 'anadolu-aof', url: 'https://lolonolo.com/anadolu-aof/' },
    ATATURK_AOF: { name: 'Atatürk Üniversitesi AÖF', slug: 'ataturk-aof', url: 'https://lolonolo.com/ataturk-aof/' },
};

// ==================== HELPERS ====================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchHTML(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 15000,
            });
            return data;
        } catch (err) {
            if (attempt < 2) { await sleep(1000 * (attempt + 1)); continue; }
            throw err;
        }
    }
}

// ==================== STEP 1: Get Departments from School Page ====================
async function scrapeDepartments(schoolKey, school) {
    console.log(`\n📚 ${school.name} — Bölümler çekiliyor...`);
    const html = await fetchHTML(school.url);
    const $ = cheerio.load(html);
    const departments = [];

    // All department links are inside the entry-content area
    const links = $('a').toArray();
    for (const el of links) {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();

        if (!href.includes(`lolonolo.com/${school.slug}/`)) continue;
        if (href === school.url || href === school.url.replace(/\/$/, '')) continue;
        if (text.length < 3) continue;
        if (/indir|İndir|reklamsız|abone|uygulama|staj|takvim|telegram/i.test(text)) continue;
        if (/play\.google|apps\.apple|shopier|humix/i.test(href)) continue;

        // Remove trailing "–" and clean text
        const cleanName = text.replace(/\s*[–-]\s*$/, '').trim();
        if (!departments.find(d => d.url === href || d.url === href + '/' || d.url + '/' === href)) {
            departments.push({ name: cleanName, url: href.replace(/\/$/, '') + '/' });
        }
    }

    console.log(`   ✅ ${departments.length} bölüm bulundu`);
    return departments;
}

// ==================== STEP 2: Get Courses from Department Page (with Year) ====================
async function scrapeCourses(dept) {
    try {
        const html = await fetchHTML(dept.url);
        const $ = cheerio.load(html);
        const courses = [];

        // Parse the content area for class sections
        const content = $('.entry-content').html() || $('article').html() || $('body').html();
        if (!content) return courses;

        // Split by class year headers (1. Sınıf, 2. Sınıf, etc.)
        // We'll look for h4/h3 headers that contain "Sınıf"
        let currentYear = null;
        let currentTerm = null; // Güz / Bahar

        const $content = cheerio.load(content);
        const elements = $content('*').toArray();

        for (const el of elements) {
            const tag = el.tagName?.toLowerCase();
            const text = $content(el).text().trim();

            // Detect year section headers
            if (/^h[2-5]$/.test(tag)) {
                const yearMatch = text.match(/(\d+)\.\s*[Ss]ınıf/);
                if (yearMatch) {
                    currentYear = yearMatch[1] + '. Sınıf';
                    // Check if "Güz" or "Bahar" is included
                    if (/güz/i.test(text)) currentTerm = 'Güz';
                    else if (/bahar/i.test(text)) currentTerm = 'Bahar';
                    else currentTerm = null;
                    continue;
                }
                // Detect Güz/Bahar sub-headers
                if (/güz/i.test(text) && !/sınıf/i.test(text)) { currentTerm = 'Güz'; continue; }
                if (/bahar/i.test(text) && !/sınıf/i.test(text)) { currentTerm = 'Bahar'; continue; }
            }

            // Collect course links
            if (tag === 'a') {
                const href = $content(el).attr('href') || '';
                const linkText = $content(el).text().trim();

                if (href.includes('lolonolo.com/') && linkText.length > 2) {
                    if (/indir|İndir|reklamsız|abone|uygulama|telegram|play\.google|apps\.apple/i.test(linkText + href)) continue;
                    if (/staj|takvim|gizlilik/i.test(linkText + href)) continue;

                    if (!courses.find(c => c.url === href)) {
                        courses.push({
                            name: linkText.replace(/\s*[–-]\s*$/, '').trim(),
                            url: href,
                            year: currentYear || 'Bilinmiyor',
                            term: currentTerm || 'Bilinmiyor',
                        });
                    }
                }
            }
        }

        return courses;
    } catch (err) {
        console.error(`     ❌ Ders çekme hatası (${dept.name}): ${err.message}`);
        return [];
    }
}

// ==================== STEP 3: Get Exam Questions from Course Page ====================
function parseQuestions(html) {
    const questions = [];
    const $ = cheerio.load(html);

    // Get the full text content
    const content = $('.entry-content').text() || $('article').text() || '';

    // Strategy 1: Parse "#### N. Question" format
    // Match questions: starts with a number followed by a period, then the question text
    const qRegex = /(?:^|\n)\s*(?:####?\s*)?(\d+)\.\s*(.+?)(?=\n\s*A\))/gs;
    const fullText = ($('.entry-content').html() || $('article').html() || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(p|div|h[1-6])[^>]*>/gi, '\n');
    const cleanText = cheerio.load(fullText).text();

    // Split by question numbers
    const lines = cleanText.split('\n');
    let currentQ = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detect question start: "1. Question text" or "#### 1. Question text"
        const qMatch = line.match(/^(?:#{1,4}\s*)?(\d+)\.\s+(.+)/);
        if (qMatch && !line.startsWith('Cevap')) {
            // Save previous question if exists
            if (currentQ && currentQ.options.A) {
                questions.push(currentQ);
            }
            currentQ = {
                number: parseInt(qMatch[1]),
                text: qMatch[2].trim(),
                options: {},
                correct: null,
            };
            // Check if options are on the same line
            extractOptionsFromLine(currentQ, qMatch[2]);
            continue;
        }

        if (!currentQ) continue;

        // Detect options: "A) text B) text C) text D) text E) text" (can be on one line or multiple)
        if (/^[A-E]\)/.test(line) || /A\)\s/.test(line)) {
            extractOptionsFromLine(currentQ, line);
        }

        // Detect answer: "Cevap : X) text" or "Cevap: X"
        const ansMatch = line.match(/Cevap\s*:\s*([A-E])\)?/i);
        if (ansMatch) {
            currentQ.correct = ansMatch[1].toUpperCase();
        }

        // Also check if question text continues on next line (append to current question text)
        if (currentQ && !qMatch && !/^[A-E]\)/.test(line) && !/Cevap/i.test(line) && line.length > 5 && !currentQ.options.A) {
            currentQ.text += ' ' + line;
        }
    }

    // Push last question
    if (currentQ && currentQ.options.A) {
        questions.push(currentQ);
    }

    return questions;
}

function extractOptionsFromLine(q, text) {
    // Parse "A) option1 B) option2 C) option3 D) option4 E) option5"
    const optMatch = text.match(/([A-E])\)\s*([^A-E)]+?)(?=\s+[A-E]\)|$)/g);
    if (optMatch) {
        for (const opt of optMatch) {
            const m = opt.match(/^([A-E])\)\s*(.+)/);
            if (m) {
                q.options[m[1]] = m[2].trim();
            }
        }
    }
}

// ==================== STEP 4: Save to Database ====================
async function upsertUniversity(name, sourceUrl) {
    const res = await query(
        `INSERT INTO universities (name, source_url) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET source_url = EXCLUDED.source_url
     RETURNING id`, [name, sourceUrl]
    );
    return res.rows[0].id;
}

async function upsertDepartment(uniId, name) {
    // Check if exists
    const existing = await query('SELECT id FROM departments WHERE university_id = $1 AND name = $2', [uniId, name]);
    if (existing.rows.length > 0) return existing.rows[0].id;
    const res = await query('INSERT INTO departments (university_id, name) VALUES ($1, $2) RETURNING id', [uniId, name]);
    return res.rows[0].id;
}

async function upsertCourse(deptId, name) {
    const existing = await query('SELECT id FROM courses WHERE department_id = $1 AND name = $2', [deptId, name]);
    if (existing.rows.length > 0) return existing.rows[0].id;
    const res = await query('INSERT INTO courses (department_id, name) VALUES ($1, $2) RETURNING id', [deptId, name]);
    return res.rows[0].id;
}

async function upsertExam(courseId, year, term, type) {
    const existing = await query(
        'SELECT id FROM exams WHERE course_id = $1 AND year = $2 AND term = $3 AND type = $4',
        [courseId, year || 'Bilinmiyor', term || 'Bilinmiyor', type || 'Çıkmış Sorular']
    );
    if (existing.rows.length > 0) return existing.rows[0].id;
    const res = await query(
        'INSERT INTO exams (course_id, year, term, type) VALUES ($1, $2, $3, $4) RETURNING id',
        [courseId, year || 'Bilinmiyor', term || 'Bilinmiyor', type || 'Çıkmış Sorular']
    );
    return res.rows[0].id;
}

async function insertQuestion(examId, questionText, options, correct) {
    // Check if similiar question already exists (by first 100 chars)
    const prefix = questionText.substring(0, 100);
    const existing = await query(
        'SELECT id FROM questions WHERE exam_id = $1 AND question_text LIKE $2',
        [examId, prefix + '%']
    );
    if (existing.rows.length > 0) return existing.rows[0].id;

    const res = await query(
        'INSERT INTO questions (exam_id, question_text, options, explanation) VALUES ($1, $2, $3, $4) RETURNING id',
        [examId, questionText, JSON.stringify({ ...options, correct }), `Doğru Cevap: ${correct}`]
    );
    return res.rows[0].id;
}

// ==================== MAIN ====================
async function main() {
    console.log('🚀 MedDoc Lolonolo Scraper Başlıyor...\n');
    await migrateV2();

    const stats = { universities: 0, departments: 0, courses: 0, questions: 0, errors: [] };
    const schoolEntries = FILTER_SCHOOL
        ? [[FILTER_SCHOOL, schools[FILTER_SCHOOL]]]
        : Object.entries(schools);

    for (const [schoolKey, school] of schoolEntries) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🏛️  ${school.name}`);
        console.log('='.repeat(60));

        // 1. Upsert university
        const uniId = await upsertUniversity(school.name, school.url);
        stats.universities++;

        // 2. Get departments
        const departments = await scrapeDepartments(schoolKey, school);

        for (const dept of departments) {
            console.log(`\n  📂 ${dept.name}`);

            const deptId = await upsertDepartment(uniId, dept.name);
            stats.departments++;

            // 3. Get courses from department page
            await sleep(DELAY_MS);
            const courses = await scrapeCourses(dept);
            console.log(`     📖 ${courses.length} ders bulundu`);

            // 4. Process courses in batches
            for (let i = 0; i < courses.length; i += BATCH_SIZE) {
                const batch = courses.slice(i, i + BATCH_SIZE);

                await Promise.all(batch.map(async (course) => {
                    try {
                        const courseId = await upsertCourse(deptId, course.name);
                        stats.courses++;

                        // 5. Fetch course page and extract questions
                        await sleep(DELAY_MS);
                        const courseHtml = await fetchHTML(course.url);
                        const questions = parseQuestions(courseHtml);

                        if (questions.length > 0) {
                            // Determine year/term from course data
                            const examId = await upsertExam(courseId, course.year, course.term, 'Çıkmış Sorular');

                            for (const q of questions) {
                                if (q.text && Object.keys(q.options).length >= 3) {
                                    await insertQuestion(examId, q.text, q.options, q.correct);
                                    stats.questions++;
                                }
                            }
                            console.log(`       ✅ ${course.name}: ${questions.length} soru`);
                        } else {
                            console.log(`       ⚪ ${course.name}: soru bulunamadı`);
                        }
                    } catch (err) {
                        console.error(`       ❌ ${course.name}: ${err.message}`);
                        stats.errors.push({ course: course.name, error: err.message });
                    }
                }));

                await sleep(DELAY_MS);
            }
        }
    }

    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 ÖZET');
    console.log('='.repeat(60));
    console.log(`  Üniversite: ${stats.universities}`);
    console.log(`  Bölüm:      ${stats.departments}`);
    console.log(`  Ders:        ${stats.courses}`);
    console.log(`  Soru:        ${stats.questions}`);
    console.log(`  Hata:        ${stats.errors.length}`);

    if (stats.errors.length > 0) {
        console.log('\n⚠️  Hatalar:');
        stats.errors.forEach(e => console.log(`  - ${e.course}: ${e.error}`));
    }

    console.log('\n✅ Scraping tamamlandı!');
    process.exit(0);
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
