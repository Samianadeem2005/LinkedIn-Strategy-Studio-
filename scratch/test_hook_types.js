const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../linkedin_content.db');
const db = new Database(dbPath);

console.log("=== CHECKING TABLES IN DB ===");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables found:", tables.map(t => t.name));

if (tables.some(t => t.name === 'hook_bank')) {
  console.error("ERROR: hook_bank table still exists!");
} else {
  console.log("SUCCESS: hook_bank table is NOT present.");
}

if (tables.some(t => t.name === 'hook_types')) {
  console.log("SUCCESS: hook_types table exists.");
  const count = db.prepare("SELECT COUNT(*) as c FROM hook_types").get().c;
  console.log(`Hook types count: ${count}`);
  const rows = db.prepare("SELECT name, description, angles, best_fit_pillars FROM hook_types LIMIT 5").all();
  console.log("Sample rows:", JSON.stringify(rows, null, 2));
} else {
  console.error("ERROR: hook_types table was not found!");
}
