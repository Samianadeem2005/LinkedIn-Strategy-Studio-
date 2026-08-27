import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const all = searchParams.get('all') === 'true' || searchParams.get('all') === '1';
    const limit = parseInt(searchParams.get('limit') || '4', 10);

    const db = getDb();

    if (all) {
      const hooks = db.prepare('SELECT * FROM hook_bank ORDER BY used_count DESC, rowid DESC').all();
      return NextResponse.json(hooks);
    }

    let hooks;
    if (category) {
      hooks = db.prepare('SELECT * FROM hook_bank WHERE category = ? ORDER BY RANDOM() LIMIT ?').all(category, limit);
      if (hooks.length < limit) {
        const remaining = limit - hooks.length;
        const extra = db.prepare('SELECT * FROM hook_bank WHERE category != ? OR category IS NULL ORDER BY RANDOM() LIMIT ?').all(category, remaining);
        hooks = [...hooks, ...extra];
      }
    } else {
      hooks = db.prepare('SELECT * FROM hook_bank ORDER BY RANDOM() LIMIT ?').all(limit);
    }

    return NextResponse.json(hooks);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();

    // Increment usage count for selected hooks
    if (Array.isArray(body.hookIds) && body.hookIds.length > 0) {
      const stmt = db.prepare('UPDATE hook_bank SET used_count = used_count + 1 WHERE id = ?');
      const updateMany = db.transaction((ids: string[]) => {
        for (const id of ids) stmt.run(id);
      });
      updateMany(body.hookIds);
      return NextResponse.json({ success: true, updated: body.hookIds.length });
    }

    // Create new hook manually
    const { hook_text, category, source } = body;
    if (!hook_text?.trim()) {
      return NextResponse.json({ error: 'Hook text is required.' }, { status: 400 });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO hook_bank (id, hook_text, category, source, used_count)
      VALUES (?, ?, ?, ?, 0)
    `).run(id, hook_text.trim(), (category?.trim() || 'general').toLowerCase(), source?.trim() || 'Manual Entry');

    const created = db.prepare('SELECT * FROM hook_bank WHERE id = ?').get(id);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
