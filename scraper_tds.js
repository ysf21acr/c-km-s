const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const courseInfo = { id: 'tibbi-dok', name: 'Tıbbi Dokümantasyon', icon: '📄', color: 'linear-gradient(135deg,#4361ee,#5e60ce)' };
const targetUrl = 'https://lolonolo.com/auzef/tibbi-dokumantasyon-ve-sekreterlik/';

const QUIZZES = {};
const QUIZ_LIST = [];

async function scrapePageForQuestions(url) {
    try {
        const { data } = await axios.get(url, { timeout: 10000 });
        const $ = cheerio.load(data);
        const questions = [];

        $('.hdq_question').each((i, el) => {
            let qText = $(el).find('.hdq_question_heading').text().replace(/#\d+\./, '').trim();
            if (!qText) qText = $(el).find('.hdq_question_title').text().trim();

            const options = [];
            let correctIdx = 0;

            $(el).find('.hdq_label_answer').each((j, optEl) => {
                let optText = $(optEl).find('.hdq_aria_label').text().trim();
                optText = optText.replace(/^[A-E]\)\s*/, '').replace(/'/g, "\\'").trim();
                options.push(optText);
                const isCorrect = $(optEl).find('input').attr('value') === '1';
                if (isCorrect) correctIdx = j;
            });

            let expText = $(el).closest('.hdq_quiz_wrapper').next('p').text() || 'Cevap: ' + options[correctIdx];
            expText = expText.replace(/'/g, "\\'").trim();
            qText = qText.replace(/'/g, "\\'").trim();

            if (qText && options.length > 0) {
                questions.push({ q: qText, o: options, a: correctIdx, exp: expText });
            }
        });
        return questions;
    } catch (e) {
        console.error(`Failed to fetch ${url}: ${e.message}`);
        return [];
    }
}

async function run() {
    console.log(`Processing targeted course: ${courseInfo.name}`);
    let subLinks = [];
    const seenUrls = new Set();

    try {
        const { data } = await axios.get(targetUrl);
        const $ = cheerio.load(data);
        $('a').each((i, el) => {
            const text = $(el).text().trim().toLowerCase();
            const href = $(el).attr('href');
            if (href && href.includes('lolonolo.com') && !seenUrls.has(href)) {
                if (text.includes('vize') || text.includes('final') || text.includes('büt') || text.includes('soru') || text.includes('deneme')) {
                    subLinks.push({ url: href, title: $(el).text().trim() });
                    seenUrls.add(href);
                }
            }
        });
    } catch (e) {
        console.error(`Error loading index ${targetUrl}:`, e.message);
    }

    // To ensure we don't accidentally fetch random off-topic things, let's limit to top 15 relevant looking links
    subLinks = subLinks.slice(0, 15);

    for (const link of subLinks) {
        console.log(`  Fetching quiz: ${link.title} - ${link.url}`);
        const qs = await scrapePageForQuestions(link.url);
        if (qs.length > 0) {
            const quizId = `${courseInfo.id}-auto-${Math.random().toString(36).substr(2, 6)}`;
            let tag = 'DENEME';
            if (link.title.toLowerCase().includes('vize')) tag = 'VİZE';
            if (link.title.toLowerCase().includes('final')) tag = 'FİNAL';
            if (link.title.toLowerCase().includes('büt')) tag = 'BÜTÜNLEME';

            QUIZZES[quizId] = {
                title: `${courseInfo.name} — ${link.title}`,
                qs: qs
            };

            QUIZ_LIST.push({
                id: quizId,
                label: courseInfo.name,
                sub: link.title,
                icon: courseInfo.icon,
                color: courseInfo.color,
                tag: tag
            });
        }
    }

    fs.writeFileSync('c:/Users/Hp/Desktop/meddoc/payload_tds.json', JSON.stringify({ QUIZZES, QUIZ_LIST }, null, 2), 'utf8');
    console.log('Successfully wrote payload to payload_tds.json');
}

run();
