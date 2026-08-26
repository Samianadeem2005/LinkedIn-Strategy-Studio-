import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM post_anatomy ORDER BY order_index ASC').all();
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.section_name?.trim()) {
      return NextResponse.json({ error: 'Section name is required.' }, { status: 400 });
    }
    if (!body.rule_description?.trim()) {
      return NextResponse.json({ error: 'Rule description is required.' }, { status: 400 });
    }
    const db = getDb();
    const maxOrder = (db.prepare('SELECT MAX(order_index) as m FROM post_anatomy').get() as { m: number | null }).m ?? -1;
    const id = uuidv4();
    db.prepare('INSERT INTO post_anatomy (id, section_name, rule_description, order_index, applies_to_post_type_id) VALUES (?, ?, ?, ?, ?)').run(
      id,
      body.section_name.trim(),
      body.rule_description.trim(),
      body.order_index ?? maxOrder + 1,
      body.applies_to_post_type_id ?? null
    );
    return NextResponse.json(db.prepare('SELECT * FROM post_anatomy WHERE id = ?').get(id), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    // Bulk reorder: body = array of { id, order_index }
    if (Array.isArray(body)) {
      const db = getDb();
      const update = db.prepare('UPDATE post_anatomy SET order_index = ? WHERE id = ?');
      const tx = db.transaction((items: { id: string; order_index: number }[]) => {
        for (const item of items) update.run(item.order_index, item.id);
      });
      tx(body);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Expected array for bulk reorder.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
