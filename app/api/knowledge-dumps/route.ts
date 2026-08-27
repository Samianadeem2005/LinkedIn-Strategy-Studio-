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
