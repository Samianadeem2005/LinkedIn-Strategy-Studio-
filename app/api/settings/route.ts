import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    let row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown> | undefined;
    if (!row) {
      db.prepare(`INSERT INTO settings (id, frequency, anatomy_scope, tone_profile) VALUES (1, 'daily', 'global', ?)`).run(
        JSON.stringify({ formality: 'mixed', sentenceLength: 'short', bannedPhrases: [], languageMix: '' })
      );
      row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown>;
    }
    return NextResponse.json({ ...row, tone_profile: row.tone_profile ? JSON.parse(row.tone_profile as string) : {} });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();
    db.prepare(`
      INSERT INTO settings (id, frequency, tone_profile, anatomy_scope)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        frequency = excluded.frequency,
        tone_profile = excluded.tone_profile,
        anatomy_scope = excluded.anatomy_scope
    `).run(
      body.frequency ?? 'daily',
      JSON.stringify(body.tone_profile ?? {}),
      body.anatomy_scope ?? 'global'
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
