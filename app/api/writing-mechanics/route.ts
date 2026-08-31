import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const mechanics = db.prepare('SELECT * FROM writing_mechanics ORDER BY order_index ASC').all();
    return NextResponse.json(mechanics);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rule_name, description, prompt_directive, enabled, order_index } = body;

    if (!rule_name?.trim()) return NextResponse.json({ error: 'Rule name is required.' }, { status: 400 });
    if (!description?.trim() && !prompt_directive?.trim()) return NextResponse.json({ error: 'Description is required.' }, { status: 400 });

    const finalDescription = (description ?? prompt_directive ?? '').trim();
    const finalDirective = (prompt_directive ?? description ?? '').trim();

    const db = getDb();
    const id = uuidv4();

    let targetOrder = order_index;
    if (targetOrder === undefined || targetOrder === null) {
      const maxObj = db.prepare('SELECT MAX(order_index) as m FROM writing_mechanics').get() as { m: number | null };
      targetOrder = (maxObj?.m ?? -1) + 1;
    }

    db.prepare(`
      INSERT INTO writing_mechanics (id, rule_name, description, prompt_directive, enabled, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, rule_name.trim(), finalDescription, finalDirective, enabled ?? 1, targetOrder);

    const inserted = db.prepare('SELECT * FROM writing_mechanics WHERE id = ?').get(id);
    return NextResponse.json(inserted, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Reorder mechanics
export async function PUT(req: NextRequest) {
  try {
    const items = await req.json() as { id: string; order_index: number }[];
    if (!Array.isArray(items)) return NextResponse.json({ error: 'Expected array of items.' }, { status: 400 });

    const db = getDb();
    const stmt = db.prepare('UPDATE writing_mechanics SET order_index = ? WHERE id = ?');
    const updateMany = db.transaction((list: { id: string; order_index: number }[]) => {
      for (const item of list) stmt.run(item.order_index, item.id);
    });
    updateMany(items);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
