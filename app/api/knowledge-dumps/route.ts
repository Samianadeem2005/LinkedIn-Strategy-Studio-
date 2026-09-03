import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { processIngestionDump } from '@/lib/ingestion';

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();
    if (!rawText?.trim()) {
      return NextResponse.json({ error: 'raw_text is required.' }, { status: 400 });
    }

    const db = getDb();
    const dumpId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO knowledge_dumps (id, raw_text, status, created_at)
      VALUES (?, ?, 'pending', ?)
    `).run(dumpId, rawText, now);

    // Run chunking + extraction
    await processIngestionDump(dumpId, rawText);

    return NextResponse.json({ dumpId, status: 'reviewed' });
  } catch (e) {
    console.error('knowledge-dumps POST error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = getDb();
    const dump = db.prepare(
      "SELECT id, raw_text, clean_summary, created_at FROM knowledge_dumps WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1"
    ).get() as { id: string; raw_text: string; clean_summary?: string; created_at: string } | undefined;

    if (!dump) {
      return NextResponse.json({ dump: null });
    }

    return NextResponse.json({ dump });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dumpId = searchParams.get('dumpId');
    const db = getDb();
    if (dumpId) {
      db.prepare("UPDATE knowledge_dumps SET status = 'discarded' WHERE id = ?").run(dumpId);
      db.prepare("DELETE FROM extraction_review WHERE dump_id = ?").run(dumpId);
    } else {
      db.prepare("UPDATE knowledge_dumps SET status = 'discarded' WHERE status = 'pending'").run();
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
