const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const courseMap = {
    'https://lolonolo.com/auzef/cevre-sagligi/': { id: 'cevre-sag', name: 'Çevre Sağlığı', icon: '🌍', color: 'linear-gradient(135deg,#06d6a0,#0abde3)' },
    'https://lolonolo.com/auzef/is-sagligi-ve-guvenligiders/': { id: 'is-sag', name: 'İş Sağlığı ve Güvenliği', icon: '⚠️', color: 'linear-gradient(135deg,#ff7675,#d63031)' },
    'https://lolonolo.com/auzef/tibbi-dokumantasyon-ve-arsiv-bilgisi/': { id: 'arsiv-bil', name: 'Tıbbi Dokümantasyon ve Arşiv Bilgisi', icon: '🗂️', color: 'linear-gradient(135deg,#4361ee,#5e60ce)' },
    'https://lolonolo.com/auzef/anatomi/': { id: 'anatomi', name: 'Anatomi', icon: '🦴', color: 'linear-gradient(135deg,#ef476f,#ee5a24)' },
    'https://lolonolo.com/auzef/fizyoloji/': { id: 'fizyoloji', name: 'Fizyoloji', icon: '💉', color: 'linear-gradient(135deg,#fd79a8,#e84393)' },
    'https://lolonolo.com/auzef/orgutsel-davranis/': { id: 'orgutsel-davranis', name: 'Örgütsel Davranış', icon: '🤝', color: 'linear-gradient(135deg,#7b2fbe,#a855f7)' },
    'https://lolonolo.com/auzef/saglik-egitimi/': { id: 'saglik-egitimi', name: 'Sağlık Eğitimi', icon: '📚', color: 'linear-gradient(135deg,#fdcb6e,#e17055)' },
    'https://lolonolo.com/auzef/saglik-hizmetlerinde-yonetim/': { id: 'saglik-hizmetleri-yonetim', name: 'Sağlık Hizm. Yönetimi', icon: '🏛️', color: 'linear-gradient(135deg,#4361ee,#5e60ce)' },
    'https://lolonolo.com/auzef/tibbi-dokumantasyon-ve-icd-sistemleri/': { id: 'icd-sistemleri', name: 'ICD Sistemleri', icon: '📑', color: 'linear-gradient(135deg,#4361ee,#5e60ce)' },
    'https://lolonolo.com/auzef/yasli-sagligi/': { id: 'yasli-sagligi', name: 'Yaşlı Sağlığı', icon: '👴', color: 'linear-gradient(135deg,#fab1a0,#ff7675)' },
    'https://lolonolo.com/auzef/istatistik': { id: 'istatistik', name: 'İstatistik', icon: '📐', color: 'linear-gradient(135deg,#7b2fbe,#a855f7)' }
};

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
    const seenUrls = new Set();

    for (const [courseUrl, info] of Object.entries(courseMap)) {
        console.log(`Processing course: ${info.name}`);
        let subLinks = [];
        try {
            const { data } = await axios.get(courseUrl);
            const $ = cheerio.load(data);
            $('a').each((i, el) => {
                const text = $(el).text().trim().toLowerCase();
                const href = $(el).attr('href');
                if (href && href.includes('lolonolo.com') && !seenUrls.has(href)) {
                    if (text.includes('vize') || text.includes('final') || text.includes('soru') || text.includes('deneme')) {
                        subLinks.push({ url: href, title: $(el).text().trim() });
                        seenUrls.add(href);
                    }
                }
            });
        } catch (e) {
            console.error(`Error loading index ${courseUrl}:`, e.message);
        }

        // Process top 10 unique links per course to not overload things, or process all. Let's process top 8 to be safe on time.
        subLinks = subLinks.slice(0, 8);

        for (const link of subLinks) {
            console.log(`  Fetching quiz: ${link.title} - ${link.url}`);
            const qs = await scrapePageForQuestions(link.url);
            if (qs.length > 0) {
                const quizId = `${info.id}-auto-${Math.random().toString(36).substr(2, 6)}`;
                let tag = 'DENEME';
                if (link.title.toLowerCase().includes('vize')) tag = 'VİZE';
                if (link.title.toLowerCase().includes('final')) tag = 'FİNAL';
                if (link.title.toLowerCase().includes('büt')) tag = 'BÜTÜNLEME';

                QUIZZES[quizId] = {
                    title: `${info.name} — ${link.title}`,
                    qs: qs
                };

                QUIZ_LIST.push({
                    id: quizId,
                    label: info.name,
                    sub: link.title,
                    icon: info.icon,
                    color: info.color,
                    tag: tag
                });
            }
        }
    }

    // Write out payload
    fs.writeFileSync('c:/Users/Hp/Desktop/meddoc/payload.json', JSON.stringify({ QUIZZES, QUIZ_LIST }, null, 2), 'utf8');
    console.log('Successfully wrote payload to payload.json');
}

run();
