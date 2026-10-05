import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const BLOCKED_ANATOMY_COMPONENTS = new Set(['rehook', 'pivot', 'breakdown', 'lesson', 'nudge']);
const componentTypeFor = (name: string) => name.toLowerCase().replace(/\s+/g, '_');
const isBlockedAnatomyComponent = (name: string) => BLOCKED_ANATOMY_COMPONENTS.has(name.trim().toLowerCase());

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const anatomyId = new URL(req.url).searchParams.get('anatomy_id');
    const rows = anatomyId
      ? db.prepare(`
          SELECT pc.*, ac.order_index AS anatomy_order_index
          FROM post_components pc
          JOIN anatomy_components ac ON ac.component_id = pc.id
          WHERE ac.anatomy_id = ?
          ORDER BY ac.order_index, pc.order_index, pc.name
        `).all(anatomyId)
      : db.prepare('SELECT * FROM post_components ORDER BY order_index, name').all();
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
    if (isBlockedAnatomyComponent(name)) {
      return NextResponse.json({ error: 'This name is reserved for Anatomy thinking journeys and cannot be used as a Post Component.' }, { status: 400 });
    }
    if (!name || !instructions) {
      return NextResponse.json({ error: 'Name and instructions are required.' }, { status: 400 });
    }
    const db = getDb();
    const id = uuidv4();
    const maxOrder = (db.prepare('SELECT MAX(order_index) AS value FROM post_components').get() as { value: number | null }).value ?? -1;
    db.prepare(`
      INSERT INTO post_components
        (id, name, description, component_type, purpose, instructions, order_index, enabled, post_type_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      body.description?.trim() || null,
      componentTypeFor(name),
      body.purpose?.trim() || null,
      instructions,
      body.order_index === undefined ? maxOrder + 1 : Number(body.order_index),
      body.enabled === undefined ? 1 : (body.enabled ? 1 : 0),
      body.post_type_id || null
    );
    return NextResponse.json(db.prepare('SELECT * FROM post_components WHERE id = ?').get(id), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
