import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const UNIVERSAL_COMPONENTS = ['Hook', 'Context', 'Body', 'CTA', 'Visual Suggestion'];
const componentTypeFor = (name: string) => name.toLowerCase().replace(/\s+/g, '_');
const isUniversalComponent = (name: string) => UNIVERSAL_COMPONENTS.includes(name.trim());

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM post_components
      ORDER BY CASE name
        WHEN 'Hook' THEN 0
        WHEN 'Context' THEN 1
        WHEN 'Body' THEN 2
        WHEN 'CTA' THEN 3
        WHEN 'Visual Suggestion' THEN 4
      END
    `).all();
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const instructions = String(body.instructions || body.rules || '').trim();
    if (!isUniversalComponent(name)) {
      return NextResponse.json({ error: `Component name must be one of: ${UNIVERSAL_COMPONENTS.join(', ')}.` }, { status: 400 });
    }
    if (!name || !instructions) {
      return NextResponse.json({ error: 'Name and instructions are required.' }, { status: 400 });
    }
    const db = getDb();
    const id = uuidv4();
    const orderIndex = UNIVERSAL_COMPONENTS.indexOf(name);
    db.prepare(`
      INSERT INTO post_components
        (id, name, description, component_type, purpose, instructions, order_index, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      body.description?.trim() || null,
      componentTypeFor(name),
      body.purpose?.trim() || null,
      instructions,
      orderIndex,
      body.enabled === undefined ? 1 : (body.enabled ? 1 : 0)
    );
    return NextResponse.json(db.prepare('SELECT * FROM post_components WHERE id = ?').get(id), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
