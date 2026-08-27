import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { hook_text, category } = body;

    const db = getDb();
    const existing = db.prepare('SELECT * FROM hook_bank WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ error: 'Hook not found.' }, { status: 404 });

    db.prepare(`
      UPDATE hook_bank
      SET hook_text = COALESCE(?, hook_text),
          category = COALESCE(?, category)
      WHERE id = ?
    `).run(
      typeof hook_text === 'string' && hook_text.trim() ? hook_text.trim() : null,
      typeof category === 'string' && category.trim() ? category.trim().toLowerCase() : null,
      id
    );

    const updated = db.prepare('SELECT * FROM hook_bank WHERE id = ?').get(id);
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

    db.prepare('DELETE FROM hook_bank WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
