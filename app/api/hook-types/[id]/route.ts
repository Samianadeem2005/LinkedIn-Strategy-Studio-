import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, angles, best_fit_pillars } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    if (!Array.isArray(angles) || angles.length === 0 || angles.some(a => !a.trim())) {
      return NextResponse.json({ error: 'At least one directional angle is required.' }, { status: 400 });
    }

    const pillars = Array.isArray(best_fit_pillars) ? best_fit_pillars : [];

    const db = getDb();
    const existing = db.prepare('SELECT id FROM hook_types WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Hook type not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE hook_types
      SET name = ?, description = ?, angles = ?, best_fit_pillars = ?
      WHERE id = ?
    `).run(name.trim(), (description ?? '').trim(), JSON.stringify(angles.map((a: string) => a.trim())), JSON.stringify(pillars), id);

    const updated = db.prepare('SELECT * FROM hook_types WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json({
      ...updated,
      angles: JSON.parse(updated.angles as string),
      best_fit_pillars: JSON.parse(updated.best_fit_pillars as string)
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare('DELETE FROM hook_types WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
