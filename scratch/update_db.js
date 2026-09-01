import Database from 'better-sqlite3';

const db = new Database('linkedin_content.db');

const newCoreFocus = `This post type exists to teach the internal mechanics of an AI concept or technology in a way any builder can learn from. Always name the actual tool, framework, or technology being discussed by its real name (e.g., LangChain, FastAPI, Mem0) — 'project-agnostic' means don't attach MY personal project or say 'I built this,' NOT that you should avoid naming the specific tool/technology itself. The tool's name and identity are part of the educational content.`;

const row = db.prepare("SELECT donts FROM post_types WHERE name = 'Value'").get();
let donts = JSON.parse(row.donts);
const newDont = "Do NOT replace the specific tool/framework name (e.g., 'LangChain') with generic substitutes like 'a framework' or 'modular orchestration layer' — name it directly and explain its real components.";

if (!donts.includes(newDont)) {
  donts.push(newDont);
}

db.prepare("UPDATE post_types SET core_focus = ?, donts = ? WHERE name = 'Value'").run(newCoreFocus, JSON.stringify(donts));

console.log('Value pillar updated in DB!');
const updated = db.prepare("SELECT name, core_focus, donts FROM post_types WHERE name = 'Value'").get();
console.log(JSON.stringify(updated, null, 2));
