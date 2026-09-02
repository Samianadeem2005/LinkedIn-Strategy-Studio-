import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validatePostType(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const db = getDb();
    const existing = db.prepare('SELECT id FROM post_types WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ error: 'Post type not found.' }, { status: 404 });
    db.prepare('UPDATE post_types SET name = ?, dos = ?, donts = ?, core_focus = ?, visual_suggestions = ? WHERE id = ?').run(
      (body.name as string).trim(),
      JSON.stringify(validation.dos),
      JSON.stringify(validation.donts),
      validation.core_focus,
      JSON.stringify(validation.visual_suggestions),
      id
    );
    const row = db.prepare('SELECT * FROM post_types WHERE id = ?').get(id) as Record<string, unknown>;
    let visual_suggestions: string[] = [];
    if (row.visual_suggestions) {
      try {
        const parsed = JSON.parse(row.visual_suggestions as string);
        visual_suggestions = Array.isArray(parsed) ? parsed : [String(row.visual_suggestions)];
      } catch {
        visual_suggestions = typeof row.visual_suggestions === 'string' ? [row.visual_suggestions] : [];
      }
    }
    return NextResponse.json({
      ...row,
      dos: JSON.parse(row.dos as string),
      donts: JSON.parse(row.donts as string),
      visual_suggestions
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    // Check for dependencies
    const usedInWeekly = db.prepare('SELECT day_of_week FROM weekly_mapping WHERE post_type_id = ?').get(id) as { day_of_week: string } | undefined;
    if (usedInWeekly) {
      return NextResponse.json({ error: `Cannot delete: this post type is assigned to ${usedInWeekly.day_of_week} in the weekly template. Unassign it first.` }, { status: 409 });
    }
    const usedInCalendar = db.prepare('SELECT id FROM calendar_entries WHERE post_type_id = ? LIMIT 1').get(id);
    if (usedInCalendar) {
      return NextResponse.json({ error: 'Cannot delete: this post type is used in calendar entries.' }, { status: 409 });
    }
    db.prepare('DELETE FROM post_anatomy WHERE applies_to_post_type_id = ?').run(id);
    db.prepare('DELETE FROM post_types WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
