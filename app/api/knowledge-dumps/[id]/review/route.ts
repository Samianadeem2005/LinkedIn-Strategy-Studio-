import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const dump = db.prepare('SELECT * FROM knowledge_dumps WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!dump) {
      return NextResponse.json({ error: 'Dump not found.' }, { status: 404 });
    }

    const reviewRows = db.prepare('SELECT * FROM extraction_review WHERE dump_id = ? ORDER BY rowid ASC').all(id) as Record<string, unknown>[];

    // Reference queries for target row display names & live current (BEFORE) text
    const postTypes = db.prepare('SELECT id, name, core_focus, dos FROM post_types').all() as { id: string; name: string; core_focus: string; dos: string }[];
    const anatomy = db.prepare('SELECT id, section_name, rule_description FROM post_anatomy').all() as { id: string; section_name: string; rule_description: string }[];
    const mechanics = db.prepare('SELECT id, rule_name, prompt_directive, description FROM writing_mechanics').all() as { id: string; rule_name: string; prompt_directive: string; description: string }[];
    const hooks = db.prepare('SELECT id, hook_text, category FROM hook_bank').all() as { id: string; hook_text: string; category: string }[];

    const nameMap: Record<string, string> = {};
    const currentTextMap: Record<string, string> = {};

    postTypes.forEach(p => {
      nameMap[p.id] = `Post Pillar → ${p.name}`;
      let dosText = '';
      try {
        const parsedDos = JSON.parse(p.dos || '[]');
        if (Array.isArray(parsedDos) && parsedDos.length > 0) dosText = parsedDos.join(' | ');
      } catch { /* skip */ }
      currentTextMap[p.id] = p.core_focus || dosText || 'No current core focus set.';
    });

    anatomy.forEach(a => {
      nameMap[a.id] = `Post Anatomy → ${a.section_name}`;
      currentTextMap[a.id] = a.rule_description || 'No current section rule set.';
    });

    mechanics.forEach(m => {
      nameMap[m.id] = `Writing Mechanic → ${m.rule_name}`;
      currentTextMap[m.id] = m.prompt_directive || m.description || 'No current directive set.';
    });

    hooks.forEach(h => {
      nameMap[h.id] = `Hook Bank → ${h.category || 'General'}`;
      currentTextMap[h.id] = h.hook_text || 'No current hook text set.';
    });

    const enrichedRows = reviewRows.map(row => {
      const isNew = Number(row.is_new_category) === 1;
      const targetRowId = row.target_row_id as string | null;
      let decision = (row.user_decision as string) || 'pending';
      if (!isNew && (decision === 'pending' || decision === 'keep')) {
        decision = 'keep_previous';
      }

      return {
        ...row,
        is_new_category: Number(row.is_new_category),
        apply_mode: (row.apply_mode as string) || 'merge',
        user_decision: decision,
        suggested_order_index: row.suggested_order_index != null ? Number(row.suggested_order_index) : null,
        target_row_name: targetRowId ? (nameMap[targetRowId] ?? 'Existing Rule') : null,
        current_text: (!isNew && targetRowId) ? (currentTextMap[targetRowId] ?? 'Current rule value not found.') : null
      };
    });

    const newItems = enrichedRows.filter(r => r.is_new_category === 1);
    const updates = enrichedRows.filter(r => r.is_new_category === 0);

    return NextResponse.json({
      dump,
      clean_summary: (dump.clean_summary as string) || null,
      newItems,
      updates,
      total: reviewRows.length
    });
  } catch (e) {
    console.error('knowledge-dumps review GET error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
