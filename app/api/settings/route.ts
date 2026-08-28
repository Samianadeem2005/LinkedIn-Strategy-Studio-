import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const DEFAULT_ABOUT_ME = "I am an AI Engineer (Software Engineering student, class of 2027) building in public, working with LLMs, multi-agent systems, RAG architectures, vector databases, and full-stack AI apps. I share my authentic learning and building journey on LinkedIn, using my real project (a company chatbot built with LangGraph, RAG, Text-to-SQL, and persistent memory) as my primary proof-of-work example.";

export async function GET() {
  try {
    const db = getDb();
    let row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown> | undefined;
    if (!row) {
      db.prepare(`INSERT INTO settings (id, frequency, anatomy_scope, tone_profile, about_me) VALUES (1, 'daily', 'global', ?, ?)`).run(
        JSON.stringify({ formality: 'mixed', sentenceLength: 'short', bannedPhrases: [], languageMix: '' }),
        DEFAULT_ABOUT_ME
      );
      row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown>;
    }
    const aboutMeVal = (row.about_me as string)?.trim() || DEFAULT_ABOUT_ME;
    return NextResponse.json({
      ...row,
      about_me: aboutMeVal,
      tone_profile: row.tone_profile ? JSON.parse(row.tone_profile as string) : {}
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();
    
    const existing = db.prepare('SELECT about_me FROM settings WHERE id = 1').get() as { about_me?: string } | undefined;
    const aboutMeToSave = body.about_me !== undefined ? body.about_me : (existing?.about_me || DEFAULT_ABOUT_ME);

    db.prepare(`
      INSERT INTO settings (id, frequency, tone_profile, anatomy_scope, about_me)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        frequency = excluded.frequency,
        tone_profile = excluded.tone_profile,
        anatomy_scope = excluded.anatomy_scope,
        about_me = excluded.about_me
    `).run(
      body.frequency ?? 'daily',
      JSON.stringify(body.tone_profile ?? {}),
      body.anatomy_scope ?? 'global',
      aboutMeToSave
    );
    return NextResponse.json({ success: true, about_me: aboutMeToSave });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
