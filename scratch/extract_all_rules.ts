import { getDb } from '../lib/db';

const db = getDb();

console.log('--- POST TYPES ---');
const postTypes = db.prepare('SELECT * FROM post_types').all();
console.log(JSON.stringify(postTypes, null, 2));

console.log('--- CONTENT INTENTS ---');
const contentIntents = db.prepare('SELECT * FROM content_intents ORDER BY post_type_id, priority ASC').all();
console.log(JSON.stringify(contentIntents, null, 2));

console.log('--- POST ANATOMY ---');
const anatomy = db.prepare('SELECT * FROM post_anatomy ORDER BY post_type_id, order_index ASC').all();
console.log(JSON.stringify(anatomy, null, 2));

console.log('--- ANATOMY INTENTS JUNCTION ---');
const anatomyIntents = db.prepare('SELECT * FROM anatomy_intents').all();
console.log(JSON.stringify(anatomyIntents, null, 2));

console.log('--- WRITING MECHANICS ---');
const mechanics = db.prepare('SELECT * FROM writing_mechanics ORDER BY order_index ASC').all();
console.log(JSON.stringify(mechanics, null, 2));

console.log('--- SETTINGS ---');
const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
console.log(JSON.stringify(settings, null, 2));

console.log('--- HOOK TYPES ---');
const hooks = db.prepare('SELECT * FROM hook_types').all();
console.log(JSON.stringify(hooks, null, 2));
