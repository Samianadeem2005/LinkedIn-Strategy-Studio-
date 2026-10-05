import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  return NextResponse.json(db.prepare('SELECT anatomy_id FROM anatomy_components WHERE component_id = ? ORDER BY order_index').all(id));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const anatomyIds: string[] = Array.isArray(body.anatomy_ids) ? body.anatomy_ids : [];
    const db = getDb();
    const replace = db.transaction(() => {
      db.prepare('DELETE FROM anatomy_components WHERE component_id = ?').run(id);
      const insert = db.prepare('INSERT INTO anatomy_components (anatomy_id, component_id, order_index) VALUES (?, ?, ?)');
      anatomyIds.forEach((anatomyId, index) => insert.run(anatomyId, id, index));
    });
    replace();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
