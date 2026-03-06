const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/meddoc',
});

async function main() {
    const pairs = [
        { source: 'b4285f33-93ec-41e5-8b14-93aadfbfd98f', target: '5435519d-7177-4c4f-8b75-fed44486f442' }, // Ataturk -> Atatürk
        { source: '79401d0b-24f2-4608-b2e8-a5141aa34a01', target: 'b2f177a6-acde-4962-acc5-66dcdc7ff7ce' }, // Anadolu -> Anadolu
        { source: '2d9efe6d-34ac-45b5-8def-08cf1812e64a', target: 'a44f783b-65ff-4d0c-8700-f3bca0b64fb8' }  // Istanbul -> İstanbul
    ];

    for (const { source, target } of pairs) {
        console.log(`Merging ${source} into ${target}...`);
        const sourceDepts = await pool.query('SELECT id, name FROM departments WHERE university_id = $1', [source]);

        for (const sDept of sourceDepts.rows) {
            const targetDepts = await pool.query('SELECT id FROM departments WHERE university_id = $1 AND name = $2', [target, sDept.name]);

            if (targetDepts.rows.length > 0) {
                const tDeptId = targetDepts.rows[0].id;
                console.log(`  Merging department '${sDept.name}'`);
                await pool.query('UPDATE courses SET department_id = $1 WHERE department_id = $2', [tDeptId, sDept.id]);
                await pool.query('UPDATE users SET department_id = $1 WHERE department_id = $2', [tDeptId, sDept.id]);
                await pool.query('DELETE FROM departments WHERE id = $1', [sDept.id]);
            } else {
                console.log(`  Moving department '${sDept.name}'`);
                await pool.query('UPDATE departments SET university_id = $1 WHERE id = $2', [target, sDept.id]);
            }
        }

        console.log(`  Moving users, scraper sources and deleting source university...`);
        await pool.query('UPDATE users SET university_id = $1 WHERE university_id = $2', [target, source]);
        await pool.query('UPDATE scraper_sources SET university_id = $1 WHERE university_id = $2', [target, source]);
        await pool.query('DELETE FROM universities WHERE id = $1', [source]);
    }
    console.log('Done!');
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
