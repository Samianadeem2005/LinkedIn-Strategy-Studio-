import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM hook_types ORDER BY rowid ASC').all() as Record<string, unknown>[];
    const hookTypes = rows.map(r => ({
      ...r,
      angles: r.angles ? JSON.parse(r.angles as string) : [],
      best_fit_pillars: r.best_fit_pillars ? JSON.parse(r.best_fit_pillars as string) : []
    }));
    return NextResponse.json(hookTypes);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO hook_types (id, name, description, angles, best_fit_pillars, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), (description ?? '').trim(), JSON.stringify(angles.map((a: string) => a.trim())), JSON.stringify(pillars), now);

    const created = db.prepare('SELECT * FROM hook_types WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json({
      ...created,
      angles: JSON.parse(created.angles as string),
      best_fit_pillars: JSON.parse(created.best_fit_pillars as string)
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
