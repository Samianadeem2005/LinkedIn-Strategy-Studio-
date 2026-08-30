import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required.' }, { status: 400 });
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'TAVILY_API_KEY is not configured in .env.local. Add it to enable web search.' },
        { status: 500 }
      );
    }

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${query.trim()} official documentation technical architecture guide best practices`,
        search_depth: 'advanced',
        include_answer: true,
        include_raw_content: false,
        max_results: 6,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Tavily error: ${err}` }, { status: 502 });
    }

    const data = await res.json();

    // Build a clean text block from results to pass to the generation prompt
    const resultsText = [
      data.answer ? `SUMMARY:\n${data.answer}` : '',
      ...((data.results ?? []) as { title: string; url: string; content: string }[]).map(
        (r, i) =>
          `SOURCE ${i + 1}: ${r.title}\nURL: ${r.url}\nSNIPPET: ${r.content?.slice(0, 600)}`
      ),
    ]
      .filter(Boolean)
      .join('\n\n---\n\n');

    return NextResponse.json({ resultsText, resultCount: data.results?.length ?? 0 });
  } catch (e) {
    console.error('web-search error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
