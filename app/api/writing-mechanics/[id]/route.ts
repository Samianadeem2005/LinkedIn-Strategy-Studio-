import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { rule_name, description, prompt_directive, enabled } = body;

    const db = getDb();
    const existing = db.prepare('SELECT * FROM writing_mechanics WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ error: 'Writing mechanic not found.' }, { status: 404 });

    const finalDesc = description !== undefined ? description : null;
    const finalDir = prompt_directive !== undefined ? prompt_directive : (description !== undefined ? description : null);

    db.prepare(`
      UPDATE writing_mechanics
      SET rule_name = COALESCE(?, rule_name),
          description = COALESCE(?, description),
          prompt_directive = COALESCE(?, prompt_directive),
          enabled = COALESCE(?, enabled)
      WHERE id = ?
    `).run(rule_name ?? null, finalDesc, finalDir, enabled !== undefined ? (enabled ? 1 : 0) : null, id);

    const updated = db.prepare('SELECT * FROM writing_mechanics WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    db.prepare('DELETE FROM writing_mechanics WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
