import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawTopic, recentTypes } = body as {
      rawTopic: string;
      recentTypes?: string[]; // names of recently used post types (for mix awareness)
    };

    if (!rawTopic?.trim()) {
      return NextResponse.json({ error: 'rawTopic is required.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured.' }, { status: 500 });

    const db = getDb();
    const postTypes = db.prepare('SELECT * FROM post_types').all() as {
      id: string; name: string; core_focus: string | null; dos: string; donts: string;
    }[];

    if (postTypes.length === 0) {
      return NextResponse.json({ error: 'No post types defined in Settings.' }, { status: 400 });
    }

    // Build pillar definitions block for the prompt
    const pillarDefs = postTypes.map(pt => {
      const dos: string[] = JSON.parse(pt.dos || '[]');
      const donts: string[] = JSON.parse(pt.donts || '[]');
      return [
        `### ${pt.name}`,
        pt.core_focus ? `Core Focus: ${pt.core_focus}` : '',
        dos.length > 0 ? `DOs: ${dos.map(d => `✓ ${d}`).join(' | ')}` : '',
        donts.length > 0 ? `DON'Ts: ${donts.map(d => `✗ ${d}`).join(' | ')}` : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    const recentContext = recentTypes && recentTypes.length > 0
      ? `\n**Recent post types used (avoid overusing the same pillar):** ${recentTypes.slice(-7).join(', ')}`
      : '';

    const prompt = `You are an AI Personal Brand Strategist for a developer who posts daily on LinkedIn.
Your job is to classify ONE raw topic into the correct post pillar from the list below.

**PILLAR DEFINITIONS (these must never overlap — read each Core Focus carefully):**
${pillarDefs}
${recentContext}

**THE RAW TOPIC TO CLASSIFY:**
"${rawTopic.trim()}"

**CLASSIFICATION RULES:**
1. Read the Core Focus of each pillar — not just the name. A topic about "how LangChain works internally" is Value/Educational, but "I struggled configuring LangChain for 3 days" is Personal, and "Here's my LangChain cheat sheet" is Lead Magnet.
2. If the topic is about a ready-to-use resource (checklist, comparison, framework) → Lead Magnet.
3. If the topic is a raw personal struggle, confusion, or honest realization → Personal.
4. If the topic references real project code/architecture/results → Showcase/Authority.
5. If the topic names a major AI company/researcher to analyze with your own angle → Authority borrow variant.
6. Otherwise: explains how something works generically → Value/Educational.
7. Consider recency: if the same pillar has been used many times recently, gently prefer a different one if the topic reasonably fits.

**OUTPUT FORMAT — respond with ONLY valid JSON, no markdown fences:**
{
  "recommended_type_id": "<id from the list below>",
  "recommended_type_name": "<name>",
  "reasoning": "One clear sentence explaining why this pillar fits this specific topic — reference the Core Focus.",
  "confidence": "high" | "medium" | "low",
  "alternative_type_id": "<id of second-best option, or null>",
  "alternative_type_name": "<name or null>",
  "alternative_reasoning": "<why this could also work, or null>"
}

**AVAILABLE POST TYPE IDs:**
${postTypes.map(pt => `- id: "${pt.id}", name: "${pt.name}"`).join('\n')}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonText = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(jsonText);

    // Validate the returned id exists in our DB
    const match = postTypes.find(pt => pt.id === parsed.recommended_type_id);
    if (!match) {
      // Fallback: match by name
      const nameMatch = postTypes.find(pt =>
        pt.name.toLowerCase() === (parsed.recommended_type_name ?? '').toLowerCase()
      );
      if (nameMatch) parsed.recommended_type_id = nameMatch.id;
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error('classify-topic error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
