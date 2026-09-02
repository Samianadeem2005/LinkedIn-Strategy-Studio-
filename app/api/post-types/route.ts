import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

function validatePostType(body: { dos?: unknown; donts?: unknown; name?: unknown; core_focus?: unknown; visual_suggestions?: unknown }) {
  const dos = Array.isArray(body.dos) ? body.dos.filter((d: unknown) => typeof d === 'string' && d.trim()) : [];
  const donts = Array.isArray(body.donts) ? body.donts.filter((d: unknown) => typeof d === 'string' && d.trim()) : [];
  const visual_suggestions = Array.isArray(body.visual_suggestions)
    ? body.visual_suggestions.filter((v: unknown) => typeof v === 'string' && v.trim())
    : typeof body.visual_suggestions === 'string' && body.visual_suggestions.trim()
    ? [body.visual_suggestions.trim()]
    : [];

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return { valid: false, error: 'Post type name is required.' };
  }
  if (dos.length === 0) {
    return { valid: false, error: 'DOs are mandatory — add at least one item.' };
  }
  if (donts.length === 0) {
    return { valid: false, error: "DON'Ts are mandatory — add at least one item." };
  }
  if (!body.core_focus || typeof body.core_focus !== 'string' || !body.core_focus.trim()) {
    return { valid: false, error: 'Core Focus is mandatory — describe what this post type is actually for.' };
  }
  return { valid: true, dos, donts, core_focus: (body.core_focus as string).trim(), visual_suggestions };
}

function parseRow(r: Record<string, unknown>) {
  let visual_suggestions: string[] = [];
  if (r.visual_suggestions) {
    try {
      const parsed = JSON.parse(r.visual_suggestions as string);
      visual_suggestions = Array.isArray(parsed) ? parsed : [String(r.visual_suggestions)];
    } catch {
      visual_suggestions = typeof r.visual_suggestions === 'string' ? [r.visual_suggestions] : [];
    }
  }
  return {
    ...r,
    dos: JSON.parse(r.dos as string),
    donts: JSON.parse(r.donts as string),
    visual_suggestions
  };
}

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM post_types ORDER BY name').all() as Record<string, unknown>[];
    return NextResponse.json(rows.map(parseRow));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validatePostType(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const db = getDb();
    const id = uuidv4();
    db.prepare('INSERT INTO post_types (id, name, dos, donts, core_focus, visual_suggestions) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      (body.name as string).trim(),
      JSON.stringify(validation.dos),
      JSON.stringify(validation.donts),
      validation.core_focus,
      JSON.stringify(validation.visual_suggestions)
    );
    const row = db.prepare('SELECT * FROM post_types WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json(parseRow(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
