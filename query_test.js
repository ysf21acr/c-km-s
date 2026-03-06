const { query } = require('./db-v2');
async function run() {
    try {
        const d = await query("SELECT id, name FROM departments WHERE name ILIKE '%Anatomi%' OR name ILIKE '%Yönetim%' LIMIT 5;");
        console.log("Depts:", d.rows);
        const c = await query("SELECT id, name, department_id FROM courses LIMIT 5;");
        console.log("Courses:", c.rows);
    } catch (e) { console.error(e); } finally { process.exit() }
}
run();
