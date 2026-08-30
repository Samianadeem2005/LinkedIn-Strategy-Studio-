import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { post_type_id } = body;

    if (!post_type_id) {
      return NextResponse.json({ error: 'post_type_id is required.' }, { status: 400 });
    }

    const db = getDb();

    // Check post type exists
    const pt = db.prepare('SELECT id FROM post_types WHERE id = ?').get(post_type_id);
    if (!pt) {
      return NextResponse.json({ error: 'Post type not found.' }, { status: 404 });
    }

    // Fetch default anatomy sections (applies_to_post_type_id IS NULL)
    const defaults = db.prepare(
      'SELECT section_name, rule_description, order_index FROM post_anatomy WHERE applies_to_post_type_id IS NULL ORDER BY order_index ASC'
    ).all() as { section_name: string; rule_description: string; order_index: number }[];

    // Transaction: Delete existing custom sections for this type, then insert cloned defaults
    const deleteStmt = db.prepare('DELETE FROM post_anatomy WHERE applies_to_post_type_id = ?');
    const insertStmt = db.prepare(
      'INSERT INTO post_anatomy (id, section_name, rule_description, order_index, applies_to_post_type_id) VALUES (?, ?, ?, ?, ?)'
    );

    const tx = db.transaction(() => {
      deleteStmt.run(post_type_id);
      for (const section of defaults) {
        insertStmt.run(uuidv4(), section.section_name, section.rule_description, section.order_index, post_type_id);
      }
    });

    tx();

    const created = db.prepare(
      'SELECT * FROM post_anatomy WHERE applies_to_post_type_id = ? ORDER BY order_index ASC'
    ).all(post_type_id);

    return NextResponse.json({ success: true, sections: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
