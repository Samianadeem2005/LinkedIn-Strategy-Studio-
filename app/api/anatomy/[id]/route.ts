import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.section_name?.trim()) return NextResponse.json({ error: 'Section name is required.' }, { status: 400 });
    if (!body.rule_description?.trim()) return NextResponse.json({ error: 'Rule description is required.' }, { status: 400 });
    const db = getDb();
    db.prepare('UPDATE post_anatomy SET section_name = ?, rule_description = ?, order_index = ?, applies_to_post_type_id = ? WHERE id = ?').run(
      body.section_name.trim(),
      body.rule_description.trim(),
      body.order_index,
      body.applies_to_post_type_id ?? null,
      id
    );
    return NextResponse.json(db.prepare('SELECT * FROM post_anatomy WHERE id = ?').get(id));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare('DELETE FROM post_anatomy WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
