/**
 * MedDoc Ã¢â‚¬â€ Lolonolo Full Scraper
 * Scrapes: University Ã¢â€ â€™ Departments Ã¢â€ â€™ Courses (by class year) Ã¢â€ â€™ Exam Questions
 * Saves to PostgreSQL database with upsert logic
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { query, migrateV2 } = require('./db-v2');

// ==================== CONFIGURATION ====================
const DELAY_MS = 400;           // delay between requests (be nice to server)
const BATCH_SIZE = 3;           // concurrent requests per batch
const FILTER_SCHOOL = process.env.FILTER_SCHOOL || null; // 'AUZEF' | 'ANADOLU_AOF' | 'ATATURK_AOF'

// ==================== SCHOOL DATA ====================
const schools = {
    AUZEF: { name: 'Ã„Â°stanbul ÃƒÅ“niversitesi AUZEF', slug: 'auzef', url: 'https://lolonolo.com/auzef/' },
    ANADOLU_AOF: { name: 'Anadolu ÃƒÅ“niversitesi AÃƒâ€“F', slug: 'anadolu-aof', url: 'https://lolonolo.com/anadolu-aof/' },
    ATATURK_AOF: { name: 'AtatÃƒÂ¼rk ÃƒÅ“niversitesi AÃƒâ€“F', slug: 'ataturk-aof', url: 'https://lolonolo.com/ataturk-aof/' },
};

// ==================== HELPERS ====================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function emitProgress(payload) {
    try {
        console.log(`__PROGRESS__ ${JSON.stringify(payload)}`);
    } catch (_) {
        // Ignore progress serialization issues so scraper flow never breaks.
    }
}

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
    console.log(`\nÄŸÅ¸â€œÅ¡ ${school.name} Ã¢â‚¬â€ BÃƒÂ¶lÃƒÂ¼mler ÃƒÂ§ekiliyor...`);
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
        if (/indir|Ã„Â°ndir|reklamsÃ„Â±z|abone|uygulama|staj|takvim|telegram/i.test(text)) continue;
        if (/play\.google|apps\.apple|shopier|humix/i.test(href)) continue;

        // Remove trailing "Ã¢â‚¬â€œ" and clean text
        const cleanName = text.replace(/\s*[Ã¢â‚¬â€œ-]\s*$/, '').trim();
        if (!departments.find(d => d.url === href || d.url === href + '/' || d.url + '/' === href)) {
            departments.push({ name: cleanName, url: href.replace(/\/$/, '') + '/' });
        }
    }

    console.log(`   Ã¢Å“â€¦ ${departments.length} bÃƒÂ¶lÃƒÂ¼m bulundu`);
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

        // Split by class year headers (1. SÃ„Â±nÃ„Â±f, 2. SÃ„Â±nÃ„Â±f, etc.)
        // We'll look for h4/h3 headers that contain "SÃ„Â±nÃ„Â±f"
        let currentYear = null;
        let currentTerm = null; // GÃƒÂ¼z / Bahar

        const $content = cheerio.load(content);
        const elements = $content('*').toArray();

        for (const el of elements) {
            const tag = el.tagName?.toLowerCase();
            const text = $content(el).text().trim();

            // Detect year section headers
            if (/^h[2-5]$/.test(tag)) {
                const yearMatch = text.match(/(\d+)\.\s*[Ss]Ã„Â±nÃ„Â±f/);
                if (yearMatch) {
                    currentYear = yearMatch[1] + '. SÃ„Â±nÃ„Â±f';
                    // Check if "GÃƒÂ¼z" or "Bahar" is included
                    if (/gÃƒÂ¼z/i.test(text)) currentTerm = 'GÃƒÂ¼z';
                    else if (/bahar/i.test(text)) currentTerm = 'Bahar';
                    else currentTerm = null;
                    continue;
                }
                // Detect GÃƒÂ¼z/Bahar sub-headers
                if (/gÃƒÂ¼z/i.test(text) && !/sÃ„Â±nÃ„Â±f/i.test(text)) { currentTerm = 'GÃƒÂ¼z'; continue; }
                if (/bahar/i.test(text) && !/sÃ„Â±nÃ„Â±f/i.test(text)) { currentTerm = 'Bahar'; continue; }
            }

            // Collect course links
            if (tag === 'a') {
                const href = $content(el).attr('href') || '';
                const linkText = $content(el).text().trim();

                if (href.includes('lolonolo.com/') && linkText.length > 2) {
                    if (/indir|Ã„Â°ndir|reklamsÃ„Â±z|abone|uygulama|telegram|play\.google|apps\.apple/i.test(linkText + href)) continue;
                    if (/staj|takvim|gizlilik/i.test(linkText + href)) continue;

                    if (!courses.find(c => c.url === href)) {
                        courses.push({
                            name: linkText.replace(/\s*[Ã¢â‚¬â€œ-]\s*$/, '').trim(),
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
        console.error(`     Ã¢ÂÅ’ Ders ÃƒÂ§ekme hatasÃ„Â± (${dept.name}): ${err.message}`);
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
        [courseId, year || 'Bilinmiyor', term || 'Bilinmiyor', type || 'Ãƒâ€¡Ã„Â±kmÃ„Â±Ã…Å¸ Sorular']
    );
    if (existing.rows.length > 0) return existing.rows[0].id;
    const res = await query(
        'INSERT INTO exams (course_id, year, term, type) VALUES ($1, $2, $3, $4) RETURNING id',
        [courseId, year || 'Bilinmiyor', term || 'Bilinmiyor', type || 'Ãƒâ€¡Ã„Â±kmÃ„Â±Ã…Å¸ Sorular']
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
    if (existing.rows.length > 0) return { id: existing.rows[0].id, inserted: false };

    const res = await query(
        'INSERT INTO questions (exam_id, question_text, options, explanation) VALUES ($1, $2, $3, $4) RETURNING id',
        [examId, questionText, JSON.stringify({ ...options, correct }), `DoÃ„Å¸ru Cevap: ${correct}`]
    );
    return { id: res.rows[0].id, inserted: true };
}

// ==================== MAIN ====================
async function main() {
    console.log('ÄŸÅ¸Å¡â‚¬ MedDoc Lolonolo Scraper BaÃ…Å¸lÃ„Â±yor...\n');
    await migrateV2();

    const stats = { universities: 0, departments: 0, courses: 0, questions: 0, errors: [] };
    const progress = {
        university_key: FILTER_SCHOOL || 'ALL',
        departments_total: 0,
        departments_done: 0,
        courses_total: 0,
        courses_done: 0,
        questions_found: 0,
        questions_saved: 0,
        errors_count: 0,
        current_department: null,
        current_course: null,
        last_completed_course: null,
        last_course_questions: 0,
        last_error: null,
        stage: 'idle'
    };

    function pushProgress(extra = {}) {
        const deptPct = progress.departments_total > 0
            ? Math.min(100, Math.round((progress.departments_done / progress.departments_total) * 100))
            : 0;
        const coursePct = progress.courses_total > 0
            ? Math.min(100, Math.round((progress.courses_done / progress.courses_total) * 100))
            : 0;
        const overallPct = Math.round((deptPct * 0.4) + (coursePct * 0.6));
        emitProgress({
            ...progress,
            department_progress_pct: deptPct,
            course_progress_pct: coursePct,
            overall_progress_pct: overallPct,
            ...extra
        });
    }

    pushProgress({ stage: 'start' });

    const schoolEntries = FILTER_SCHOOL
        ? [[FILTER_SCHOOL, schools[FILTER_SCHOOL]]]
        : Object.entries(schools);

    for (const [schoolKey, school] of schoolEntries) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`ÄŸÅ¸Ââ€ºÃ¯Â¸Â  ${school.name}`);
        console.log('='.repeat(60));

        // 1. Upsert university
        const uniId = await upsertUniversity(school.name, school.url);
        stats.universities++;

        // 2. Get departments
        const departments = await scrapeDepartments(schoolKey, school);
        progress.university_key = schoolKey;
        progress.departments_total = departments.length;
        progress.current_department = null;
        progress.current_course = null;
        pushProgress({ stage: 'departments_discovered' });

        for (const dept of departments) {
            console.log(`\n  ÄŸÅ¸â€œâ€š ${dept.name}`);

            progress.current_department = dept.name;
            progress.current_course = null;
            const deptId = await upsertDepartment(uniId, dept.name);
            stats.departments++;

            // 3. Get courses from department page
            await sleep(DELAY_MS);
            const courses = await scrapeCourses(dept);
            progress.courses_total += courses.length;
            pushProgress({ stage: 'courses_discovered', current_department: dept.name });
            console.log(`     ÄŸÅ¸â€œâ€“ ${courses.length} ders bulundu`);

            // 4. Process courses in batches
            for (let i = 0; i < courses.length; i += BATCH_SIZE) {
                const batch = courses.slice(i, i + BATCH_SIZE);

                await Promise.all(batch.map(async (course) => {
                    try {
                        progress.current_course = course.name;
                        const courseId = await upsertCourse(deptId, course.name);
                        stats.courses++;

                        // 5. Fetch course page and extract questions
                        await sleep(DELAY_MS);
                        const courseHtml = await fetchHTML(course.url);
                        const questions = parseQuestions(courseHtml);
                        progress.questions_found += questions.length;

                        if (questions.length > 0) {
                            // Determine year/term from course data
                            const examId = await upsertExam(courseId, course.year, course.term, 'Ãƒâ€¡Ã„Â±kmÃ„Â±Ã…Å¸ Sorular');

                            let insertedForCourse = 0;
                            for (const q of questions) {
                                if (q.text && Object.keys(q.options).length >= 3) {
                                    const saved = await insertQuestion(examId, q.text, q.options, q.correct);
                                    if (saved.inserted) {
                                        stats.questions++;
                                        insertedForCourse++;
                                        progress.questions_saved += 1;
                                    }
                                }
                            }
                            console.log(`       Ã¢Å“â€¦ ${course.name}: ${questions.length} soru`);
                            progress.last_course_questions = insertedForCourse;
                        } else {
                            progress.last_course_questions = 0;
                            console.log(`       Ã¢Å¡Âª ${course.name}: soru bulunamadÃ„Â±`);
                        }
                    } catch (err) {
                        console.error(`       Ã¢ÂÅ’ ${course.name}: ${err.message}`);
                        stats.errors.push({ course: course.name, error: err.message });
                        progress.errors_count += 1;
                        progress.last_error = `${course.name}: ${err.message}`;
                        progress.last_course_questions = 0;
                        pushProgress({ stage: 'course_error', current_course: course.name, current_department: dept.name });
                    } finally {
                        progress.courses_done += 1;
                        progress.last_completed_course = course.name;
                        progress.current_course = null;
                        pushProgress({
                            stage: 'course_processed',
                            current_course: course.name,
                            current_department: dept.name,
                            questions_found: progress.questions_found,
                            questions_saved: progress.questions_saved,
                            errors_count: progress.errors_count
                        });
                    }
                }));

                await sleep(DELAY_MS);
            }

            progress.departments_done += 1;
            progress.current_course = null;
            pushProgress({ stage: 'department_completed', current_department: dept.name });
        }
    }

    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('ÄŸÅ¸â€œÅ  Ãƒâ€“ZET');
    console.log('='.repeat(60));
    console.log(`  ÃƒÅ“niversite: ${stats.universities}`);
    console.log(`  BÃƒÂ¶lÃƒÂ¼m:      ${stats.departments}`);
    console.log(`  Ders:        ${stats.courses}`);
    console.log(`  Soru:        ${stats.questions}`);
    console.log(`  Hata:        ${stats.errors.length}`);

    if (stats.errors.length > 0) {
        console.log('\nÃ¢Å¡Â Ã¯Â¸Â  Hatalar:');
        stats.errors.forEach(e => console.log(`  - ${e.course}: ${e.error}`));
    }

    console.log('\nÃ¢Å“â€¦ Scraping tamamlandÃ„Â±!');
    progress.departments_done = progress.departments_total;
    progress.courses_done = progress.courses_total;
    progress.current_course = null;
    pushProgress({
        stage: 'completed',
        questions_found: progress.questions_found,
        questions_saved: progress.questions_saved,
        errors_count: progress.errors_count,
        department_progress_pct: 100,
        course_progress_pct: 100,
        overall_progress_pct: 100
    });
    process.exit(0);
}

main().catch(err => {
    console.error('ÄŸÅ¸â€™Â¥ Fatal error:', err);
    process.exit(1);
});
