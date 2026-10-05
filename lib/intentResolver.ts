import { getDb, ContentIntentRow, getContentIntents } from '@/lib/db';

export interface IntentResolutionResult {
  intentId: string;
  intentName: string;
  displayName: string;
  confidence: 'high' | 'medium' | 'default' | 'explicit';
  source: 'explicit' | 'deterministic' | 'default';
  matchedSignals?: string[];
  reason: string;
}

interface SignalRule {
  intent: string;
  weight: number;
  patterns: RegExp[];
}

/**
 * Deterministic semantic signal rules for each content pillar.
 * Evaluates semantic patterns, syntactic clues, and domain indicators without requiring an LLM call.
 */
const PILLAR_SIGNAL_RULES: Record<string, SignalRule[]> = {
  'value': [
    {
      intent: 'compare',
      weight: 10,
      patterns: [
        /\b(?:vs\.?|versus|compared to|comparison|difference between|pros and cons|which is better|trade-?offs? between)\b/i,
        /\b(?:alternative to|when to use \w+ (?:over|vs|instead of))\b/i,
        /\b(?:(\w+)\s+or\s+(\w+)\s*\?)/i
      ]
    },
    {
      intent: 'explain_problem',
      weight: 9,
      patterns: [
        /\b(?:why (?:my|our|the)?\s*[\w\s]{1,30}\s*(?:failed|broke|returned|keeps? failing|crashes|throws?|is slow|doesn't work))\b/i,
        /\b(?:root cause|irrelevant chunks?|hallucination issue|memory leak|bottleneck|debugging|silent failure|gotcha|fix for)\b/i,
        /\b(?:how to fix|common bug|troubleshooting)\b/i
      ]
    },
    {
      intent: 'correct_misconception',
      weight: 9,
      patterns: [
        /\b(?:I thought\b.*\b(?:meant|was|only)\b)/i,
        /\b(?:misconception|common myth|myth vs reality|people mistakenly think|false belief|don't confuse \w+ with)\b/i,
        /\b(?:is not (?:the same as|actually)|stop thinking that)\b/i
      ]
    },
    {
      intent: 'technical_analogy',
      weight: 8,
      patterns: [
        /\b(?:think of (?:it|this) as|like a\b.*\bin real life|analogy|imagine a|mental model|explained using a|simplified analogy)\b/i,
        /\b(?:an analogy for|if \w+ were a)\b/i
      ]
    },
    {
      intent: 'teach_concept',
      weight: 6,
      patterns: [
        /\b(?:what (?:is|are|exactly is)|how (?:does|do) \w+ work|guide to|deep dive into|fundamentals of|understanding \w+|introduction to)\b/i,
        /\b(?:step-by-step breakdown|core mechanics of|explained from scratch)\b/i
      ]
    }
  ],

  'lead magnet': [
    {
      intent: 'checklist',
      weight: 10,
      patterns: [
        /\b(?:checklist|audit list|verification list|pre-flight|readiness check|before you (?:ship|deploy|launch))\b/i,
        /\b(?:\d+\s*(?:checks|items to check|things to verify))\b/i
      ]
    },
    {
      intent: 'roadmap',
      weight: 9,
      patterns: [
        /\b(?:roadmap|learning path|path to|step-by-step guide|from zero to|beginner to (?:pro|advanced)|progression|stages)\b/i,
        /\b(?:milestones for|how to get from \w+ to \w+)\b/i
      ]
    },
    {
      intent: 'framework',
      weight: 8,
      patterns: [
        /\b(?:framework|mental model|matrix|rubric|decision framework|system for|playbook)\b/i,
        /\b(?:4-step framework|3-part system)\b/i
      ]
    },
    {
      intent: 'template',
      weight: 8,
      patterns: [
        /\b(?:template|starter kit|scaffold|boilerplate|prompt template|boilerplate repo|configuration file)\b/i,
        /\b(?:plug-and-play|copy-paste template)\b/i
      ]
    },
    {
      intent: 'resource_stack',
      weight: 8,
      patterns: [
        /\b(?:resource stack|tool stack|curated (?:list|resources|tools)|top \d+ tools|libraries you need|awesome list|collection of)\b/i,
        /\b(?:cheat sheet|my go-to tools)\b/i
      ]
    }
  ],

  'authority': [
    {
      intent: 'industry_observation',
      weight: 10,
      patterns: [
        /\b(?:pakistan(?:i)?\s+startups?|global startups?|ecosystem|fintech in|market observation|I(?:'ve)? noticed a pattern|interesting shift|local tech)\b/i,
        /\b(?:hiring trends?|remote work in|tech ecosystem|something interesting is happening in)\b/i
      ]
    },
    {
      intent: 'company_analysis',
      weight: 9,
      patterns: [
        /\b(?:how (?:this|the)?\s*company|pricing strategy|business model|product decision|OpenAI(?:'s)? move|Stripe(?:'s)? decision|Anthropic(?:'s)? strategy)\b/i,
        /\b(?:why \w+ (?:pivoted|acquired|changed pricing|killed|launched)|company breakdown|case analysis)\b/i
      ]
    },
    {
      intent: 'founder_lens',
      weight: 9,
      patterns: [
        /\b(?:founder(?:'s)? (?:bet|lens|mindset|philosophy)|CEO|Sam Altman|Karpathy|Zuck|bold bet|contrarian bet|leadership lesson)\b/i,
        /\b(?:why (?:the )?founder decided to|founders making bets)\b/i
      ]
    },
    {
      intent: 'contrarian_view',
      weight: 9,
      patterns: [
        /\b(?:why I disagree|unpopular opinion|contrarian take|hot take|counter-argument|common consensus is wrong|stop doing this)\b/i,
        /\b(?:the uncomfortable truth|why \w+ is overrated)\b/i
      ]
    },
    {
      intent: 'trend_analysis',
      weight: 8,
      patterns: [
        /\b(?:trend|macro shift|developer tooling shift|AI adoption wave|next generation of|rise of|evolution of|where \w+ is heading)\b/i,
        /\b(?:the future of|industry shifts?)\b/i
      ]
    }
  ],

  'personal': [
    {
      intent: 'turning_point',
      weight: 10,
      patterns: [
        /\b(?:the moment (?:I|everything)|turning point|pivotal moment|decided to (?:quit|pivot|start)|crossroads|that day changed)\b/i,
        /\b(?:when I finally realized|never looked back)\b/i
      ]
    },
    {
      intent: 'failure_reflection',
      weight: 10,
      patterns: [
        /\b(?:my (?:biggest )?mistake|I failed|I kept making the same mistake|regret|what went wrong|hard lesson|embarrassing)\b/i,
        /\b(?:I was completely wrong|wasted (?:months|weeks|time)|failed to deliver)\b/i
      ]
    },
    {
      intent: 'growth_story',
      weight: 8,
      patterns: [
        /\b(?:from \w+ to \w+|how I learned|years ago vs now|my journey|starting out vs|when I was a beginner|evolution)\b/i,
        /\b(?:struggled with \w+ for years|growth)\b/i
      ]
    },
    {
      intent: 'learning_reflection',
      weight: 7,
      patterns: [
        /\b(?:I realized|reflection|thought I knew|mental shift|hard-won lesson|personal take|candid thought|honest reflection)\b/i,
        /\b(?:something I learned the hard way)\b/i
      ]
    }
  ],

  'showcase': [
    {
      intent: 'architecture_explanation',
      weight: 10,
      patterns: [
        /\b(?:architecture|system design|multi-agent|LangGraph|state graph|RAG pipeline|vector store|pgvector|agentic flow|backend design)\b/i,
        /\b(?:how the system is designed|component breakdown|data flow)\b/i
      ]
    },
    {
      intent: 'before_after',
      weight: 9,
      patterns: [
        /\b(?:before and after|migrated from|reduced (?:latency|cost|memory) by|from \d+ (?:ms|seconds) to \d+|performance improved)\b/i,
        /\b(?:old (?:system|way) vs new (?:system|way)|benchmarks? before vs after)\b/i
      ]
    },
    {
      intent: 'technical_decision',
      weight: 9,
      patterns: [
        /\b(?:why (?:I|we) chose \w+ over|technical decision|trade-?offs? of using|why not \w+|decided against)\b/i,
        /\b(?:evaluating \w+ vs \w+|tech stack choice)\b/i
      ]
    },
    {
      intent: 'case_study',
      weight: 8,
      patterns: [
        /\b(?:case study|production deployment|scaling to|benchmark results|real-world results|load testing|production metrics)\b/i
      ]
    },
    {
      intent: 'build_story',
      weight: 8,
      patterns: [
        /\b(?:how I built|building (?:a|my)|just shipped|project breakdown|weekend project|proof of work|demo of)\b/i,
        /\b(?:built with \w+|here is how it works)\b/i
      ]
    }
  ]
};

/**
 * Deterministically resolves the content intent without making an LLM call.
 * 1. Checks explicit intent override if provided.
 * 2. Scans raw notes against semantic regex rules for the pillar.
 * 3. Falls back safely to pillar default intent.
 */
export function resolveContentIntent(
  rawNotes: string,
  postTypeId: string,
  pillarName: string,
  explicitIntentIdOrName?: string | null
): IntentResolutionResult {
  const allIntents = getContentIntents(postTypeId);
  if (allIntents.length === 0) {
    // Fallback if no intents in DB yet
    return {
      intentId: '',
      intentName: 'general',
      displayName: 'General',
      confidence: 'default',
      source: 'default',
      reason: 'No content intents defined for this pillar.'
    };
  }

  // 1. Explicit user selection
  if (explicitIntentIdOrName && explicitIntentIdOrName !== 'auto') {
    const matched = allIntents.find(
      it => it.id === explicitIntentIdOrName || it.name.toLowerCase() === explicitIntentIdOrName.toLowerCase()
    );
    if (matched) {
      return {
        intentId: matched.id,
        intentName: matched.name,
        displayName: matched.display_name,
        confidence: 'explicit',
        source: 'explicit',
        reason: `Explicitly selected by user: "${matched.display_name}".`
      };
    }
  }

  const cleanPillarKey = pillarName.toLowerCase().trim();
  const rules = PILLAR_SIGNAL_RULES[cleanPillarKey] || [];

  const text = rawNotes || '';
  const scores: Record<string, { score: number; signals: string[] }> = {};

  // Initialize all known intents for this pillar
  for (const it of allIntents) {
    scores[it.name] = { score: 0, signals: [] };
  }

  // 2. Evaluate semantic pattern rules
  for (const rule of rules) {
    if (!scores[rule.intent]) {
      scores[rule.intent] = { score: 0, signals: [] };
    }
    for (const pat of rule.patterns) {
      const match = text.match(pat);
      if (match) {
        scores[rule.intent].score += rule.weight;
        scores[rule.intent].signals.push(match[0]);
      }
    }
  }

  // Find highest scoring intent
  let highestScore = 0;
  let winningIntentName: string | null = null;
  let winningSignals: string[] = [];

  for (const [name, data] of Object.entries(scores)) {
    if (data.score > highestScore) {
      highestScore = data.score;
      winningIntentName = name;
      winningSignals = data.signals;
    }
  }

  // Threshold check: need at least 6 points of signal
  if (winningIntentName && highestScore >= 6) {
    const intentObj = allIntents.find(it => it.name === winningIntentName);
    if (intentObj) {
      return {
        intentId: intentObj.id,
        intentName: intentObj.name,
        displayName: intentObj.display_name,
        confidence: highestScore >= 10 ? 'high' : 'medium',
        source: 'deterministic',
        matchedSignals: winningSignals,
        reason: `Matched semantic signals in notes: "${winningSignals.slice(0, 3).join('", "')}".`
      };
    }
  }

  // 3. Fallback: Pillar's designated default intent
  const defaultIntent = allIntents.find(it => it.is_default === 1) || allIntents[0];
  return {
    intentId: defaultIntent.id,
    intentName: defaultIntent.name,
    displayName: defaultIntent.display_name,
    confidence: 'default',
    source: 'default',
    reason: `Input is ambiguous or open-ended. Using default intent for ${pillarName}: "${defaultIntent.display_name}".`
  };
}
