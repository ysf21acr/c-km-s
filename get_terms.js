const { query } = require('./db-v2');

async function run() {
    try {
        const res = await query(`
            SELECT c.name as course_name, COUNT(e.id) as c, MIN(e.term) as t 
            FROM exams e 
            JOIN courses c ON c.id = e.course_id 
            GROUP BY c.name 
            HAVING MIN(e.term) = 'Bilinmiyor' AND MAX(e.term) = 'Bilinmiyor'
            LIMIT 20
        `);
        console.log("UNKNOWN COURSES:");
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
run();
