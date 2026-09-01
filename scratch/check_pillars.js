import Database from 'better-sqlite3';

const db = new Database('linkedin_content.db');

const lm = db.prepare("SELECT name, dos, donts FROM post_types WHERE name = 'Lead Magnet'").get();
const p = db.prepare("SELECT name, dos, donts FROM post_types WHERE name = 'Personal'").get();

console.log('=== LEAD MAGNET ===');
console.log('DOS:\n', JSON.stringify(JSON.parse(lm.dos), null, 2));
console.log('DONTS:\n', JSON.stringify(JSON.parse(lm.donts), null, 2));

console.log('\n=== PERSONAL ===');
console.log('DOS:\n', JSON.stringify(JSON.parse(p.dos), null, 2));
console.log('DONTS:\n', JSON.stringify(JSON.parse(p.donts), null, 2));
