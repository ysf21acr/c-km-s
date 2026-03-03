const bcrypt = require('bcryptjs');
const { query } = require('./db-v2');

(async () => {
    const r = await query("SELECT password_hash FROM users WHERE email='acar@gmail.com'");
    const hash = r.rows[0].password_hash;
    const tests = ['123456', 'password', 'acar123', 'test123', 'admin123', 'acar', '12345678', 'yusuf123', 'yusuf'];
    for (const p of tests) {
        const ok = await bcrypt.compare(p, hash);
        if (ok) { console.log('SIFRE:', p); process.exit(); }
    }
    console.log('Yaygin sifrelerden degil. Hash:', hash.substring(0, 20) + '...');
    process.exit();
})();
