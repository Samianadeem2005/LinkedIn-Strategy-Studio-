import { getDb } from '../lib/db';

const db = getDb();
console.log('--- POST TYPES ---');
console.log(db.prepare('SELECT id, name FROM post_types').all());

console.log('--- CUSTOM PILLAR RULES ---');
console.log(db.prepare('SELECT id, name, pillar_ids FROM custom_pillar_rules').all());

console.log('--- CONTENT INTENTS ---');
console.log(db.prepare('SELECT id, name, post_type_id FROM content_intents').all());
