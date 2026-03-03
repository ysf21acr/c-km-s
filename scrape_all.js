const https = require('https');
const http = require('http');
const fs = require('fs');

// All department URLs extracted from the 3 school main pages
const schools = {
  "AUZEF": {
    name: "İstanbul Üniversitesi AUZEF",
    slug: "auzef",
    departments: [
      { name: "Çocuk Gelişimi Lisans", url: "https://lolonolo.com/auzef/cocukgelisimi/" },
      { name: "Çocuk Gelişimi Ön Lisans", url: "https://lolonolo.com/auzef/cocuk-gelisimi-on-lisans" },
      { name: "Sosyal Hizmetler", url: "https://lolonolo.com/auzef/sosyal-hizmetler/" },
      { name: "Tıbbi Dokümantasyon Ve Sekreterlik", url: "https://lolonolo.com/auzef/tibbi-dokumantasyon-ve-sekreterlik/" },
      { name: "Sosyoloji", url: "https://lolonolo.com/auzef/auzefsosyoloji/" },
      { name: "Siyaset Bilimi Ve Kamu Yönetimi", url: "https://lolonolo.com/auzef/siyaset-bilimi-ve-kamu-yonetimi" },
      { name: "İş Sağlığı Ve Güvenliği Lisans", url: "https://lolonolo.com/auzef/is-sagligi-ve-guvenligi-lisans" },
      { name: "İş Sağlığı Ve Güvenliği Ön Lisans", url: "https://lolonolo.com/auzef/is-sagligi-ve-guvenligi-on-lisans/" },
      { name: "İktisat", url: "https://lolonolo.com/auzef/iktisat-acikogretim/" },
      { name: "Tarih", url: "https://lolonolo.com/auzef/tarih" },
      { name: "Coğrafya", url: "https://lolonolo.com/auzef/cografya" },
      { name: "Web Tasarımı ve Kodlama", url: "https://lolonolo.com/auzef/web-tasarimi-ve-kodlama/" },
      { name: "Felsefe", url: "https://lolonolo.com/auzef/felsefe-lisans/" },
      { name: "Siyaset Bilimi Ve Uluslararası İlişkiler", url: "https://lolonolo.com/auzef/siyaset-bilimi-ve-uluslararasi-iliskiler-lisans-app/" },
      { name: "İşletme", url: "https://lolonolo.com/auzef/isletme/" },
      { name: "Hukuk Büro Yönetimi Ve Sekreterliği", url: "https://lolonolo.com/auzef/hukuk-buro-yonetimi-ve-sekreterligi-app/" },
      { name: "Yaşlı Bakımı", url: "https://lolonolo.com/auzef/yasli-bakimi/" },
      { name: "Bankacılık Ve Sigortacılık", url: "https://lolonolo.com/auzef/bankacilik-ve-sigortacilik/" },
      { name: "Laborant Ve Veteriner Sağlık", url: "https://lolonolo.com/auzef/laborant-ve-veteriner-saglik/" },
      { name: "İnsan Kaynakları Yönetimi Lisans", url: "https://lolonolo.com/auzef/insan-kaynaklari-yonetimi-lisans/" },
      { name: "Sivil Hava Ulaştırma İşletmeciliği", url: "https://lolonolo.com/auzef/sivil-hava-ulastirma-isletmeciligi" },
      { name: "Perakende Satış Ve Mağaza Yönetimi", url: "https://lolonolo.com/auzef/perakende-satis-ve-magaza-yonetimi-app/" },
      { name: "Uluslararası Ticaret Ve Lojistik Yönetimi", url: "https://lolonolo.com/auzef/uluslararasi-ticaret-ve-lojistik-yonetimi-lisans-app/" },
      { name: "Kültürel Miras Ve Turizm Önlisans", url: "https://lolonolo.com/auzef/kulturel-miras-ve-turizm" },
      { name: "Sağlık Kurumları İşletmeciliği", url: "https://lolonolo.com/auzef/saglik-kurumlari-isletmeciligi/" },
      { name: "Sağlık Yönetimi Lisans Tamamlama", url: "https://lolonolo.com/auzef/saglik-yonetimi-lisans-tamamlama" },
      { name: "Yönetim Bilişim Sistemleri Lisans", url: "https://lolonolo.com/auzef/yonetim-bilisim-sistemleri-lisans/" },
      { name: "Hemşirelik Lisans Tamamlama", url: "https://lolonolo.com/auzef/hemsirelik-lisans-tamamlama-app/" },
      { name: "Acil Durum Ve Afet Yönetimi", url: "https://lolonolo.com/auzef/acil-durum-ve-afet-yonetimi-app/" },
      { name: "Acil Yardım Ve Afet Yönetimi", url: "https://lolonolo.com/auzef/acil-yardim-ve-afet-yonetimi-app/" },
      { name: "Marka İletişimi", url: "https://lolonolo.com/auzef/auzef-marka-iletisimi/" },
      { name: "Grafik Tasarımı Ön Lisans", url: "https://lolonolo.com/auzef/auzef-grafik-tasarimi-on-lisans/" },
      { name: "Egzersiz Ve Spor Bilimleri", url: "https://lolonolo.com/auzef/egzersiz-ve-spor-bilimleri/" },
      { name: "Bilgisayar Programcılığı", url: "https://lolonolo.com/auzef/bilgisayar-programciligi/" },
      { name: "E-Ticaret ve Pazarlama", url: "https://lolonolo.com/auzef/e-ticaret-ve-pazarlama/" },
      { name: "Rekreasyon Lisans", url: "https://lolonolo.com/auzef/rekreasyon-lisans/" },
      { name: "Uluslararası Girişimcilik", url: "https://lolonolo.com/auzef/uluslararasi-girisimcilik/" },
      { name: "Adalet", url: "https://lolonolo.com/auzef/adalet-on-lisans-app/" },
      { name: "İşletme Yönetimi Önlisans", url: "https://lolonolo.com/auzef/isletme-yonetimi-onlisans/" },
      { name: "İlahiyat Önlisans", url: "https://lolonolo.com/auzef/ilahiyat-onlisans/" },
      { name: "Halkla İlişkiler Ve Tanıtım Lisans", url: "https://lolonolo.com/auzef/halkla-iliskiler-ve-tanitim-lisans-uzaktan/" },
      { name: "Medya ve İletişim Ön Lisans", url: "https://lolonolo.com/auzef/medya-ve-iletisim-uzaktan-on-lisans-uzaktan/" },
      { name: "Coğrafi Bilgi Sistemleri Ön Lisans", url: "https://lolonolo.com/auzef/cografi-bilgi-sistemleri-on-lisans-uzaktan/" },
      { name: "Gazetecilik Lisans", url: "https://lolonolo.com/auzef/gazetecilik-lisans-uzaktan/" },
    ]
  },
  "ANADOLU_AOF": {
    name: "Anadolu Üniversitesi AÖF",
    slug: "anadolu-aof",
    departments: [
      // Önlisans
      { name: "Acil Durum ve Afet Yönetimi", url: "https://lolonolo.com/anadolu-aof/aof-acil-durum-ve-afet-yonetimi-onlisans/" },
      { name: "Aşçılık", url: "https://lolonolo.com/anadolu-aof/ascilik/" },
      { name: "Bankacılık ve Sigortacılık", url: "https://lolonolo.com/anadolu-aof/aof-bankacilik-ve-sigortacilik-onlisans/" },
      { name: "Bilgisayar Programcılığı", url: "https://lolonolo.com/anadolu-aof/aof-bilgisayar-programciligi-onlisans/" },
      { name: "Büro Yönetimi ve Yönetici Asistanlığı", url: "https://lolonolo.com/anadolu-aof/aof-buro-yonetimi-ve-yonetici-asistanligi-onlisans/" },
      { name: "Coğrafi Bilgi Sistemleri", url: "https://lolonolo.com/anadolu-aof/aof-cografi-bilgi-sistemleri-onlisans/" },
      { name: "Çağrı Merkezi Hizmetleri", url: "https://lolonolo.com/anadolu-aof/aof-cagri-merkezi-hizmetleri-onlisans/" },
      { name: "Çocuk Gelişimi Ön Lisans", url: "https://lolonolo.com/anadolu-aof/aof-cocuk-gelisimi-on-lisans/" },
      { name: "Dış Ticaret", url: "https://lolonolo.com/anadolu-aof/aof-dis-ticaret-onlisans/" },
      { name: "Elektrik Enerjisi Üretim İletim ve Dağıtımı", url: "https://lolonolo.com/anadolu-aof/aof-elektrik-enerjisi-uretim-iletim-ve-dagitimi-onlisans/" },
      { name: "Emlak Yönetimi", url: "https://lolonolo.com/anadolu-aof/aof-emlak-yonetimi-onlisans/" },
      { name: "Engelli Bakımı ve Rehabilitasyon", url: "https://lolonolo.com/anadolu-aof/aof-engelli-bakimi-ve-rehabilitasyon-onlisans/" },
      { name: "Ev İdaresi", url: "https://lolonolo.com/anadolu-aof/aof-ev-idaresi-onlisans/" },
      { name: "Fotoğrafçılık ve Kameramanlık", url: "https://lolonolo.com/anadolu-aof/aof-fotografcilik-ve-kameramanlik-onlisans/" },
      { name: "Halkla İlişkiler ve Tanıtım", url: "https://lolonolo.com/anadolu-aof/aof-halkla-iliskiler-ve-tanitim-onlisans/" },
      { name: "İlahiyat", url: "https://lolonolo.com/anadolu-aof/aof-ilahiyat-onlisans/" },
      { name: "İnsan Kaynakları Yönetimi", url: "https://lolonolo.com/anadolu-aof/aof-insan-kaynaklari-yonetimi-onlisans/" },
      { name: "İş Sağlığı ve Güvenliği", url: "https://lolonolo.com/anadolu-aof/aof-is-sagligi-ve-guvenligi-onlisans/" },
      { name: "İşletme Yönetimi", url: "https://lolonolo.com/anadolu-aof/aof-isletme-yonetimi-onlisans/" },
      { name: "Kültürel Miras ve Turizm", url: "https://lolonolo.com/anadolu-aof/aof-kulturel-miras-ve-turizm-onlisans/" },
      { name: "Laborant ve Veteriner Sağlık", url: "https://lolonolo.com/anadolu-aof/aof-laborant-ve-veteriner-saglik-onlisans/" },
      { name: "Lojistik", url: "https://lolonolo.com/anadolu-aof/aof-lojistik-onlisans/" },
      { name: "Marka İletişimi", url: "https://lolonolo.com/anadolu-aof/aof-marka-iletisimi-onlisans/" },
      { name: "Medya ve İletişim", url: "https://lolonolo.com/anadolu-aof/aof-medya-ve-iletisim-onlisans/" },
      { name: "Menkul Kıymetler ve Sermaye Piyasası", url: "https://lolonolo.com/anadolu-aof/aof-menkul-kiymetler-ve-sermaye-piyasasi-onlisans/" },
      { name: "Muhasebe ve Vergi Uygulamaları", url: "https://lolonolo.com/anadolu-aof/aof-muhasebe-ve-vergi-uygulamalari-onlisans/" },
      { name: "Perakende Satış ve Mağaza Yönetimi", url: "https://lolonolo.com/anadolu-aof/aof-perakende-satis-ve-magaza-yonetimi-onlisans/" },
      { name: "Radyo ve Televizyon Programcılığı", url: "https://lolonolo.com/anadolu-aof/aof-radyo-ve-televizyon-programciligi-onlisans/" },
      { name: "Sağlık Kurumları İşletmeciliği", url: "https://lolonolo.com/anadolu-aof/aof-saglik-kurumlari-isletmeciligi-onlisans/" },
      { name: "Sivil Hava Ulaştırma İşletmeciliği", url: "https://lolonolo.com/anadolu-aof/aof-sivil-hava-ulastirma-isletmeciligi-onlisans/" },
      { name: "Sosyal Hizmetler", url: "https://lolonolo.com/anadolu-aof/aof-sosyal-hizmetler-onlisans/" },
      { name: "Sosyal Medya Yöneticiliği", url: "https://lolonolo.com/anadolu-aof/aof-sosyal-medya-yoneticiligi-onlisans/" },
      { name: "Spor Yönetimi", url: "https://lolonolo.com/anadolu-aof/aof-spor-yonetimi-onlisans/" },
      { name: "Tarım Teknolojisi", url: "https://lolonolo.com/anadolu-aof/aof-tarim-teknolojisi-onlisans/" },
      { name: "Tıbbi Dokümantasyon ve Sekreterlik", url: "https://lolonolo.com/anadolu-aof/tibbi-dokumantasyon-ve-sekreterlik/" },
      { name: "Turizm ve Otel İşletmeciliği", url: "https://lolonolo.com/anadolu-aof/aof-turizm-ve-otel-isletmeciligi-onlisans/" },
      { name: "Turizm ve Seyahat Hizmetleri", url: "https://lolonolo.com/anadolu-aof/aof-turizm-ve-seyahat-hizmetleri-onlisans/" },
      { name: "Yaşlı Bakımı", url: "https://lolonolo.com/anadolu-aof/aof-yasli-bakimi-onlisans/" },
      { name: "Yerel Yönetimler", url: "https://lolonolo.com/anadolu-aof/aof-yerel-yonetimler-onlisans/" },
      { name: "Web Tasarımı ve Kodlama", url: "https://lolonolo.com/anadolu-aof/web-tasarim-ve-kodlama/" },
      // Lisans - Açıköğretim Fakültesi
      { name: "Görsel İletişim Tasarımı Lisans", url: "https://lolonolo.com/anadolu-aof/aof-gorsel-iletisim-tasarimi-lisans/" },
      { name: "Felsefe Lisans", url: "https://lolonolo.com/anadolu-aof/aof-felsefe-lisans/" },
      { name: "Halkla İlişkiler ve Reklamcılık Lisans", url: "https://lolonolo.com/anadolu-aof/aof-halkla-iliskiler-ve-reklamcilik/" },
      { name: "Sağlık Yönetimi Lisans", url: "https://lolonolo.com/anadolu-aof/aof-saglik-yonetimi-lisans/" },
      { name: "Sosyal Hizmet Lisans", url: "https://lolonolo.com/anadolu-aof/aof-sosyal-hizmet-lisans/" },
      { name: "Sosyoloji Lisans", url: "https://lolonolo.com/anadolu-aof/aof-sosyoloji-lisans/" },
      { name: "Tarih Lisans", url: "https://lolonolo.com/anadolu-aof/aof-tarih-lisans/" },
      { name: "Türk Dili ve Edebiyatı Lisans", url: "https://lolonolo.com/anadolu-aof/aof-turk-dili-ve-edebiyati-lisans/" },
      { name: "Yönetim Bilişim Sistemleri Lisans", url: "https://lolonolo.com/anadolu-aof/aof-yonetim-bilisim-sistemleri-lisans/" },
      // Lisans - İktisat Fakültesi
      { name: "Çalışma Ekonomisi ve Endüstri İlişkileri Lisans", url: "https://lolonolo.com/anadolu-aof/aof-calisma-ekonomisi-ve-endustri-iliskileri-lisans/" },
      { name: "İktisat Lisans", url: "https://lolonolo.com/anadolu-aof/aof-iktisat-lisans/" },
      { name: "Maliye Lisans", url: "https://lolonolo.com/anadolu-aof/aof-maliye-lisans/" },
      { name: "Siyaset Bilimi ve Kamu Yönetimi Lisans", url: "https://lolonolo.com/anadolu-aof/aof-siyaset-bilimi-ve-kamu-yonetimi-lisans/" },
      { name: "Uluslararası İlişkiler Lisans", url: "https://lolonolo.com/anadolu-aof/aof-uluslararasi-iliskiler-lisans/" },
      // Lisans - İşletme Fakültesi
      { name: "Havacılık Yönetimi Lisans", url: "https://lolonolo.com/anadolu-aof/aof-havacilik-yonetimi/" },
      { name: "İşletme Lisans", url: "https://lolonolo.com/anadolu-aof/aof-isletme-lisans/" },
      { name: "Turizm İşletmeciliği Lisans", url: "https://lolonolo.com/anadolu-aof/aof-turizm-isletmeciligi/" },
      { name: "Uluslararası Ticaret ve Lojistik Lisans", url: "https://lolonolo.com/anadolu-aof/aof-uluslararasi-ticaret-ve-lojistik/" },
    ]
  },
  "ATATURK_AOF": {
    name: "Atatürk Üniversitesi AÖF",
    slug: "ataturk-aof",
    departments: [
      { name: "Sosyal Hizmet Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-sosyal-hizmet-lisans/" },
      { name: "Sosyal Hizmet Lisans Tamamlama", url: "https://lolonolo.com/ataturk-aof/ata-aof-sosyal-hizmet-lisans-tamamlama/" },
      { name: "Sağlık Yönetimi Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-saglik-yonetimi-lisans/" },
      { name: "Sağlık Yönetimi Lisans Tamamlama", url: "https://lolonolo.com/ataturk-aof/ata-aof-saglik-yonetimi-lisans-tamamlama/" },
      { name: "Tıbbi Dokümantasyon ve Sekreterlik", url: "https://lolonolo.com/ataturk-aof/ata-aof-tibbi-dokumantasyon-ve-sekreterlik/" },
      { name: "Acil Durum ve Afet Yönetimi Ön Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-acil-durum-ve-afet-yonetimi-on-lisans/" },
      { name: "Çocuk Gelişimi Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-cocuk-gelisimi-lisans/" },
      { name: "Çocuk Gelişimi Ön Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-cocuk-gelisimi-on-lisans/" },
      { name: "Kamu Yönetimi Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-kamu-yonetimi-lisans/" },
      { name: "Bilgisayar Programcılığı Ön Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-bilgisayar-programciligi-on-lisans/" },
      { name: "İş Sağlığı ve Güvenliği Ön lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-is-sagligi-ve-guvenligi-on-lisans/" },
      { name: "İş Sağlığı ve Güvenliği Lisans Tamamlama", url: "https://lolonolo.com/ataturk-aof/ata-aof-is-sagligi-ve-guvenligi-lisans-tamamlama/" },
      { name: "Sosyoloji Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-sosyoloji-lisans/" },
      { name: "Reklamcılık Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-reklamcilik-lisans/" },
      { name: "Sivil Hava Ulaştırma İşletmeciliği Ön Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-sivil-hava-ulastirma-isletmeciligi-onlisans/" },
      { name: "İşletme Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-isletme-lisans/" },
      { name: "Rekreasyon Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-rekreasyon-lisans/" },
      { name: "Grafik Sanatlar Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-grafik-sanatlar-lisans/" },
      { name: "Web Tasarımı ve Kodlama Ön Lisans", url: "https://lolonolo.com/ataturk-aof/ata-aof-web-tasarimi-ve-kodlama-on-lisans/" },
    ]
  }
};

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function extractCourses(html) {
  const courses = [];
  // Match links within the main content area - pattern: <a href="https://lolonolo.com/...">CourseName</a>
  const linkRegex = /<a[^>]*href="(https:\/\/lolonolo\.com\/[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  
  // Also try to detect class year sections
  const sectionRegex = /(?:<h[2-4][^>]*>.*?(\d+)\.\s*[Ss]ınıf.*?<\/h[2-4]>|####\s*(\d+)\.\s*[Ss]ınıf)/gi;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].trim();
    
    // Filter out non-course links
    if (
      href.includes('play.google.com') ||
      href.includes('apps.apple.com') ||
      href.includes('shopier.com') ||
      href.includes('t.me/') ||
      href.includes('humix.com') ||
      href.includes('themegrill.com') ||
      href.includes('wordpress.com') ||
      href.includes('gizlilik-politikasi') ||
      href.includes('/faq') ||
      text.includes('İndir') ||
      text.includes('indir') ||
      text.includes('REKLAMSIZ') ||
      text.includes('ABONE') ||
      text.includes('Abone ol') ||
      text.includes('Staj Başvuru') ||
      text === 'Videos' ||
      text === 'Privacy Policy' ||
      text === 'Gizlilik Politikası' ||
      text === 'ColorMag' ||
      text.includes('UYGULAMAMIZI') ||
      text.includes('Uygulamamızı') ||
      text.includes('Akademik Takvim') ||
      text.includes('Telegram') ||
      href.includes('auzefsinav.istanbul.edu.tr')
    ) continue;

    // Only include links that point to course pages (within school subdirectory)
    if (
      href.includes('/auzef/') ||
      href.includes('/anadolu-aof/') ||
      href.includes('/ataturk-aof/')
    ) {
      // Avoid department-level links (links back to main department pages)
      const isMainDeptLink = Object.values(schools).some(school =>
        school.departments.some(d => d.url === href || d.url === href + '/')
      );
      if (!isMainDeptLink) {
        // Avoid duplicates
        if (!courses.find(c => c.url === href)) {
          courses.push({ name: text, url: href });
        }
      }
    }
  }

  return courses;
}

async function scrapeDepartment(dept) {
  try {
    console.log(`  Scraping: ${dept.name}...`);
    const html = await fetchPage(dept.url);
    const courses = extractCourses(html);
    console.log(`    Found ${courses.length} courses`);
    return { ...dept, courses };
  } catch (err) {
    console.error(`  ERROR scraping ${dept.name}: ${err.message}`);
    return { ...dept, courses: [], error: err.message };
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const result = {};
  
  for (const [schoolKey, school] of Object.entries(schools)) {
    console.log(`\n=== ${school.name} (${school.departments.length} departments) ===`);
    result[schoolKey] = {
      name: school.name,
      slug: school.slug,
      departments: []
    };
    
    // Process departments in batches of 5
    for (let i = 0; i < school.departments.length; i += 5) {
      const batch = school.departments.slice(i, i + 5);
      const results = await Promise.all(batch.map(d => scrapeDepartment(d)));
      result[schoolKey].departments.push(...results);
      await sleep(500); // Be nice to the server
    }
  }
  
  // Calculate stats
  let totalDepts = 0, totalCourses = 0;
  for (const school of Object.values(result)) {
    totalDepts += school.departments.length;
    for (const dept of school.departments) {
      totalCourses += dept.courses.length;
    }
  }
  
  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Schools: ${Object.keys(result).length}`);
  console.log(`Departments: ${totalDepts}`);
  console.log(`Courses: ${totalCourses}`);
  
  // Save to file
  fs.writeFileSync('school_data.json', JSON.stringify(result, null, 2), 'utf8');
  console.log(`\nData saved to school_data.json`);
}

main().catch(console.error);
