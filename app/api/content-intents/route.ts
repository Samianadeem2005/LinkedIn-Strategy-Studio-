import { NextRequest, NextResponse } from 'next/server';
import { getDb, getContentIntents } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postTypeId = searchParams.get('post_type_id') || undefined;
    const intents = getContentIntents(postTypeId);
    return NextResponse.json(intents);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, display_name, description, post_type_id, priority, is_default } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Intent code name is required (e.g. industry_observation).' }, { status: 400 });
    }
    if (!display_name?.trim()) {
      return NextResponse.json({ error: 'Display name is required (e.g. Industry Observation).' }, { status: 400 });
    }
    if (!post_type_id) {
      return NextResponse.json({ error: 'Pillar (post_type_id) is required.' }, { status: 400 });
    }

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    // If marked default, un-default others for this pillar
    if (is_default) {
      db.prepare('UPDATE content_intents SET is_default = 0 WHERE post_type_id = ?').run(post_type_id);
    }

    db.prepare(`
      INSERT INTO content_intents (id, name, display_name, description, post_type_id, priority, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim().toLowerCase().replace(/\s+/g, '_'),
      display_name.trim(),
      description?.trim() || null,
      post_type_id,
      priority ?? 0,
      is_default ? 1 : 0,
      now,
      now
    );

    const created = db.prepare(`
      SELECT ci.*, pt.name as post_type_name
      FROM content_intents ci
      LEFT JOIN post_types pt ON ci.post_type_id = pt.id
      WHERE ci.id = ?
    `).get(id);

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
