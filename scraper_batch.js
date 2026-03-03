const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const courseMap = {
    'https://lolonolo.com/auzef/ataturk-ilkeleri-ve-inkilap-tarihi-1/': { id: 'ataturk-1', name: 'A.İ. ve İnk. Tarihi 1', icon: '🏛️', color: 'linear-gradient(135deg,#e63946,#d62828)' },
    'https://lolonolo.com/auzef/istatistik/': { id: 'istatistik', name: 'İstatistik', icon: '📐', color: 'linear-gradient(135deg,#7b2fbe,#a855f7)' },
    'https://lolonolo.com/auzef/halkla-iliskiler/': { id: 'halkla-iliskiler', name: 'Halkla İlişkiler', icon: '🤝', color: 'linear-gradient(135deg,#4cc9f0,#4361ee)' },
    'https://lolonolo.com/auzef/bilgi-teknolojileri/': { id: 'bilgi-tek', name: 'Bilgi Teknolojileri', icon: '💻', color: 'linear-gradient(135deg,#06d6a0,#118ab2)' },
    'https://lolonolo.com/auzef/tibbi-dokumantasyon/': { id: 'tibbi-dok', name: 'Tıbbi Dokümantasyon', icon: '📄', color: 'linear-gradient(135deg,#4361ee,#5e60ce)' },
    'https://lolonolo.com/auzef/turkdili/': { id: 'turk-dili-1', name: 'Türk Dili 1', icon: '🇹🇷', color: 'linear-gradient(135deg,#e63946,#d62828)' },
    'https://lolonolo.com/auzef/yabancidil/': { id: 'yabanci-dil-1', name: 'Yabancı Dil 1', icon: '🌍', color: 'linear-gradient(135deg,#fca311,#e85d04)' },
    'https://lolonolo.com/auzef/ataturk-ilkeleri-ve-inkilap-tarihi-2/': { id: 'ataturk-2', name: 'A.İ. ve İnk. Tarihi 2', icon: '🏛️', color: 'linear-gradient(135deg,#e63946,#d62828)' },
    'https://lolonolo.com/auzef/cevre-sagligi/': { id: 'cevre-sag', name: 'Çevre Sağlığı', icon: '🌍', color: 'linear-gradient(135deg,#06d6a0,#0abde3)' },
    'https://lolonolo.com/auzef/is-sagligi-ve-guvenligiders/': { id: 'is-sag', name: 'İş Sağlığı ve Güvenliği', icon: '⚠️', color: 'linear-gradient(135deg,#ff7675,#d63031)' },
    'https://lolonolo.com/auzef/ofis-uygulamalari/': { id: 'ofis-uyg', name: 'Ofis Uygulamaları', icon: '📁', color: 'linear-gradient(135deg,#7b2fbe,#a855f7)' },
    'https://lolonolo.com/auzef/tibbi-dokumantasyon-ve-arsiv-bilgisi/': { id: 'tibbi-dok-arsiv', name: 'Tıbbi Dok. ve Arşiv Bilgisi', icon: '🗂️', color: 'linear-gradient(135deg,#4361ee,#5e60ce)' },
    'https://lolonolo.com/auzef/auzef-turk-dili-2/': { id: 'turk-dili-2', name: 'Türk Dili 2', icon: '🇹🇷', color: 'linear-gradient(135deg,#e63946,#d62828)' },
    'https://lolonolo.com/auzef/anatomi/': { id: 'anatomi', name: 'Anatomi', icon: '🦴', color: 'linear-gradient(135deg,#ef476f,#ee5a24)' },
    'https://lolonolo.com/auzef/halk-sagligi/': { id: 'halk-sagligi', name: 'Halk Sağlığı', icon: '🏥', color: 'linear-gradient(135deg,#06d6a0,#0abde3)' },
    'https://lolonolo.com/auzef/iletisim-bilimi/': { id: 'iletisim-bilimi', name: 'İletişim Bilimi', icon: '💬', color: 'linear-gradient(135deg,#4cc9f0,#4361ee)' },
    'https://lolonolo.com/auzef/ilk-yardim/': { id: 'ilk-yardim', name: 'İlk Yardım', icon: '🩺', color: 'linear-gradient(135deg,#ff7675,#d63031)' },
    'https://lolonolo.com/auzef/tibbi-dokumantasyon-ve-saglik-islemleri/': { id: 'tibbi-dok-saglik', name: 'Tıbbi Dok. ve Sağlık İşlemleri', icon: '📋', color: 'linear-gradient(135deg,#4361ee,#5e60ce)' },
    'https://lolonolo.com/auzef/yonetim-ve-organizasyon/': { id: 'yonetim-organizasyon', name: 'Yönetim ve Organizasyon', icon: '🏢', color: 'linear-gradient(135deg,#118ab2,#073b4c)' },
    'https://lolonolo.com/auzef/fizyoloji/': { id: 'fizyoloji', name: 'Fizyoloji', icon: '💉', color: 'linear-gradient(135deg,#fd79a8,#e84393)' },
    'https://lolonolo.com/auzef/orgutsel-davranis/': { id: 'orgutsel-davranis', name: 'Örgütsel Davranış', icon: '🤝', color: 'linear-gradient(135deg,#7b2fbe,#a855f7)' },
    'https://lolonolo.com/auzef/saglik-egitimi/': { id: 'saglik-egitimi', name: 'Sağlık Eğitimi', icon: '📚', color: 'linear-gradient(135deg,#fdcb6e,#e17055)' },
    'https://lolonolo.com/auzef/saglik-hizmetlerinde-yonetim/': { id: 'saglik-hizm-yonetim', name: 'Sağlık Hizm. Yönetimi', icon: '🏛️', color: 'linear-gradient(135deg,#4361ee,#5e60ce)' },
    'https://lolonolo.com/auzef/yasli-sagligi/': { id: 'yasli-sagligi', name: 'Yaşlı Sağlığı', icon: '👴', color: 'linear-gradient(135deg,#fab1a0,#ff7675)' },
    'https://lolonolo.com/auzef/tibbi-dokumantasyon-ve-icd-sistemleri/': { id: 'tibbi-dok-icd', name: 'Tıbbi Dok. ve ICD Sis.', icon: '📑', color: 'linear-gradient(135deg,#4361ee,#5e60ce)' }
};

const QUIZZES = {};
const QUIZ_LIST = [];

async function scrapePageForQuestions(url) {
    try {
        const { data } = await axios.get(url, { timeout: 15000 });
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
        console.error(`  [X] Failed fetching quiz page ${url}: ${e.message}`);
        return [];
    }
}

async function run() {
    const seenUrls = new Set();
    let totalQs = 0;

    for (const [courseUrl, info] of Object.entries(courseMap)) {
        console.log(`\n======================================================`);
        console.log(`Processing Course: ${info.name}`);
        console.log(`======================================================`);
        let subLinks = [];
        try {
            const { data } = await axios.get(courseUrl, { timeout: 15000 });
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
            console.log(`Found ${subLinks.length} potential quiz links for ${info.name}.`);
        } catch (e) {
            console.error(`Error loading parent course index ${courseUrl}:`, e.message);
        }

        // Deliberately no hard limit on subLinks to ensure the extraction is truly "eksiksiz" (complete). 
        // Iterate through all found targeted files.
        for (const link of subLinks) {
            console.log(`  -> Fetching: ${link.title.substring(0, 50)}...`);
            const qs = await scrapePageForQuestions(link.url);

            if (qs.length > 0) {
                totalQs += qs.length;
                console.log(`     Retrieved ${qs.length} questions.`);
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

    console.log(`\n======================================================`);
    console.log(`Done processing. Total questions extracted: ${totalQs}`);
    console.log(`Total Quizzes: ${QUIZ_LIST.length}`);
    fs.writeFileSync('c:/Users/Hp/Desktop/meddoc/payload_batch.json', JSON.stringify({ QUIZZES, QUIZ_LIST }, null, 2), 'utf8');
    console.log('Successfully wrote massive payload to c:/Users/Hp/Desktop/meddoc/payload_batch.json');
}

run();
