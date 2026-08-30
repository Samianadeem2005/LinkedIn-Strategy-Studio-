import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { post_type_id } = body;

    if (!post_type_id) {
      return NextResponse.json({ error: 'post_type_id is required.' }, { status: 400 });
    }

    const db = getDb();
    const info = db.prepare('DELETE FROM post_anatomy WHERE applies_to_post_type_id = ?').run(post_type_id);

    return NextResponse.json({ success: true, deletedCount: info.changes }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
