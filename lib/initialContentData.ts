export interface InitialIntent {
  pillar: string; // 'Value' | 'Lead Magnet' | 'Authority' | 'Personal' | 'Showcase'
  name: string; // unique code key e.g. 'teach_concept'
  displayName: string;
  description: string;
  isDefault: boolean;
  priority: number;
}

export interface InitialAnatomy {
  pillar: string;
  name: string;
  purpose: string;
  thinkingFlow: string[];
  writingStyle: string;
  constraints?: string;
  intents: string[]; // matching intent names
}

export const INITIAL_CONTENT_INTENTS: InitialIntent[] = [
  // ── VALUE PILLAR INTENTS ─────────────────────────────────────
  {
    pillar: 'Value',
    name: 'teach_concept',
    displayName: 'Teach Concept',
    description: 'Educate on one specific concept, tool, or technique from first principles with actionable engineering depth.',
    isDefault: true,
    priority: 1
  },
  {
    pillar: 'Value',
    name: 'explain_problem',
    displayName: 'Explain Problem & Fix',
    description: 'Diagnose why a technical problem or unexpected failure happens and provide the real mechanism that fixes it.',
    isDefault: false,
    priority: 2
  },
  {
    pillar: 'Value',
    name: 'compare',
    displayName: 'Compare Approaches',
    description: 'Compare two architectural approaches, frameworks, or tools, detailing practical trade-offs and decision criteria.',
    isDefault: false,
    priority: 3
  },
  {
    pillar: 'Value',
    name: 'correct_misconception',
    displayName: 'Correct Misconception',
    description: 'Challenge a widespread false belief or mistaken assumption with concrete technical reality.',
    isDefault: false,
    priority: 4
  },
  {
    pillar: 'Value',
    name: 'technical_analogy',
    displayName: 'Technical Analogy',
    description: 'Demystify an abstract or complex system using a simple, relatable everyday analogy mapped back to code/architecture.',
    isDefault: false,
    priority: 5
  },

  // ── LEAD MAGNET PILLAR INTENTS ────────────────────────────────
  {
    pillar: 'Lead Magnet',
    name: 'checklist',
    displayName: 'Checklist',
    description: 'Offer a high-value, actionable list of verification steps, pre-deployment checks, or essential audit items.',
    isDefault: true,
    priority: 1
  },
  {
    pillar: 'Lead Magnet',
    name: 'framework',
    displayName: 'Framework',
    description: 'Offer a structured mental model or decision framework that simplifies complex engineering decisions.',
    isDefault: false,
    priority: 2
  },
  {
    pillar: 'Lead Magnet',
    name: 'roadmap',
    displayName: 'Roadmap',
    description: 'Provide a step-by-step learning or implementation progression from beginner state to advanced capability.',
    isDefault: false,
    priority: 3
  },
  {
    pillar: 'Lead Magnet',
    name: 'template',
    displayName: 'Template / Scaffold',
    description: 'Offer a ready-to-use template, starter repo, or boiler-plate scaffold with clear setup instructions.',
    isDefault: false,
    priority: 4
  },
  {
    pillar: 'Lead Magnet',
    name: 'resource_stack',
    displayName: 'Resource Stack',
    description: 'Curate a focused stack of essential tools, libraries, documentation, or repos needed for a specific job.',
    isDefault: false,
    priority: 5
  },

  // ── AUTHORITY PILLAR INTENTS ─────────────────────────────────
  {
    pillar: 'Authority',
    name: 'industry_observation',
    displayName: 'Industry Observation',
    description: 'Original, paragraph-led analysis of an emerging pattern in startups, technology adoption, or market trends.',
    isDefault: true,
    priority: 1
  },
  {
    pillar: 'Authority',
    name: 'company_analysis',
    displayName: 'Company Analysis',
    description: 'Dissect an important strategic, product, or architectural decision made by a startup or established tech company.',
    isDefault: false,
    priority: 2
  },
  {
    pillar: 'Authority',
    name: 'founder_lens',
    displayName: 'Founder Lens',
    description: 'Examine a non-obvious bet, strategic philosophy, or counter-intuitive decision made by a founder.',
    isDefault: false,
    priority: 3
  },
  {
    pillar: 'Authority',
    name: 'trend_analysis',
    displayName: 'Trend Analysis',
    description: 'Analytical synthesis of a macro developer, AI, or SaaS trend backed by concrete market examples.',
    isDefault: false,
    priority: 4
  },
  {
    pillar: 'Authority',
    name: 'contrarian_view',
    displayName: 'Contrarian View',
    description: 'Evidence-based, nuanced disagreement with popular industry consensus without sensationalism or cliches.',
    isDefault: false,
    priority: 5
  },

  // ── PERSONAL PILLAR INTENTS ──────────────────────────────────
  {
    pillar: 'Personal',
    name: 'learning_reflection',
    displayName: 'Learning Reflection',
    description: 'Honest reflection on a hard-earned realization, mindset shift, or professional principle.',
    isDefault: true,
    priority: 1
  },
  {
    pillar: 'Personal',
    name: 'turning_point',
    displayName: 'Turning Point',
    description: 'Story of a specific professional moment or decision that fundamentally altered direction.',
    isDefault: false,
    priority: 2
  },
  {
    pillar: 'Personal',
    name: 'failure_reflection',
    displayName: 'Failure Reflection',
    description: 'Candid story of a real mistake, what was misunderstood, and how it permanently improved practice.',
    isDefault: false,
    priority: 3
  },
  {
    pillar: 'Personal',
    name: 'growth_story',
    displayName: 'Growth Story',
    description: 'Authentic narrative showing the gap between early struggle and current competence without humblebrags.',
    isDefault: false,
    priority: 4
  },

  // ── SHOWCASE PILLAR INTENTS ──────────────────────────────────
  {
    pillar: 'Showcase',
    name: 'build_story',
    displayName: 'Build Story',
    description: 'Narrative of a real project build detailing problem, decisions, execution hurdles, and benchmark outcomes.',
    isDefault: true,
    priority: 1
  },
  {
    pillar: 'Showcase',
    name: 'architecture_explanation',
    displayName: 'Architecture Explanation',
    description: 'Comprehensive technical breakdown of system components, state flows, data pipelines, and design trade-offs.',
    isDefault: false,
    priority: 2
  },
  {
    pillar: 'Showcase',
    name: 'case_study',
    displayName: 'Case Study',
    description: 'End-to-end review of a solved technical challenge with concrete operational benchmarks and metrics.',
    isDefault: false,
    priority: 3
  },
  {
    pillar: 'Showcase',
    name: 'before_after',
    displayName: 'Before / After',
    description: 'Concrete side-by-side contrast of a legacy inefficient implementation versus the upgraded architecture.',
    isDefault: false,
    priority: 4
  },
  {
    pillar: 'Showcase',
    name: 'technical_decision',
    displayName: 'Technical Decision',
    description: 'Why a specific technical decision (database, framework, schema, state graph) was selected over alternatives.',
    isDefault: false,
    priority: 5
  }
];

export const INITIAL_ANATOMIES: InitialAnatomy[] = [
  // ── PERSONAL ANATOMIES ───────────────────────────────────────
  {
    pillar: 'Personal',
    name: 'Turning Point',
    purpose: 'Tell a real professional moment that fundamentally changed the writer\'s thinking and trajectory.',
    thinkingFlow: [
      'Open with the specific moment or turning point as a bare, compelling fact.',
      'Explain what you initially thought or assumed before that moment.',
      'Describe what actually happened or went unexpectedly.',
      'Reveal the realization that clicked.',
      'Show what permanently changed in your approach or mindset.'
    ],
    writingStyle: 'Story-driven and conversational. Natural paragraphs. Grounded in lived experience, emotionally honest, no corporate fluff or artificial motivational lessons.',
    intents: ['turning_point', 'learning_reflection', 'growth_story']
  },
  {
    pillar: 'Personal',
    name: 'Before / After',
    purpose: 'Show a meaningful professional evolution without turning it into generic motivational content.',
    thinkingFlow: [
      'Paint the before state (how you used to approach the problem or work).',
      'Detail the friction or recurring struggle that forced a reassessment.',
      'Describe the small but pivotal change made in thinking or technique.',
      'Show the after state and the concrete difference it produced.',
      'End on an earned personal reflection on craftsmanship or discipline.'
    ],
    writingStyle: 'Grounded contrast, natural storytelling flow. Avoids dramatic before/after exaggeration; focuses on authentic professional maturation.',
    intents: ['growth_story', 'learning_reflection']
  },
  {
    pillar: 'Personal',
    name: 'Failure Story',
    purpose: 'Show a real technical or professional mistake, the root misunderstanding, and the resulting change in practice.',
    thinkingFlow: [
      'State what you initially expected or set out to accomplish.',
      'Describe the failure or breakdown candidly.',
      'Unpack why it failed and the specific assumption you had wrong.',
      'Explain what you fundamentally misunderstood at the time.',
      'Share the new approach you adopted to ensure it never happens again.'
    ],
    writingStyle: 'Humble, candid, and self-aware. Zero melodrama. The takeaway feels earned through real grit, not textbook wisdom.',
    intents: ['failure_reflection', 'learning_reflection']
  },
  {
    pillar: 'Personal',
    name: 'Micro Story',
    purpose: 'A concise, punchy personal snapshot capturing a single realization without forced elongation.',
    thinkingFlow: [
      'Open with a single vivid moment or interaction.',
      'State the one sharp realization it created in your mind.',
      'Close on one practical takeaway for the reader.'
    ],
    writingStyle: 'Crisp, minimalist, 1-2 sentence beats. Do not pad with unnecessary backstory or force a list of 3 lessons.',
    intents: ['learning_reflection', 'turning_point']
  },

  // ── VALUE ANATOMIES ──────────────────────────────────────────
  {
    pillar: 'Value',
    name: 'Myth → Reality → Explanation',
    purpose: 'Correct a common industry or engineering misconception through clear technical reasoning and evidence.',
    thinkingFlow: [
      'State the common misconception clearly without mocking those who hold it.',
      'Present the actual reality of how the system/concept behaves.',
      'Explain the underlying technical mechanism that causes the difference.',
      'Conclude with the practical implication for building or designing systems.'
    ],
    writingStyle: 'Crisp contrast, educational and authoritative yet accessible. Uses concrete technical examples rather than abstract theories.',
    intents: ['correct_misconception', 'teach_concept']
  },
  {
    pillar: 'Value',
    name: 'Problem → Why → Fix',
    purpose: 'Diagnose a recurring technical problem, explain its root mechanism, and provide an actionable fix.',
    thinkingFlow: [
      'Highlight a concrete problem, symptom, or failure mode engineers encounter.',
      'Explain why it happens under the hood (the root cause mechanism).',
      'Walk through what actually fixes it reliably.',
      'Provide a practical example or snippet demonstrating the resolution.'
    ],
    writingStyle: 'Diagnostic, actionable, and structured. Clear transitions from problem statement to root-cause explanation to solution.',
    intents: ['explain_problem', 'teach_concept']
  },
  {
    pillar: 'Value',
    name: 'Technical Analogy',
    purpose: 'Demystify a complex technical concept using a familiar, intuitive real-world mental model.',
    thinkingFlow: [
      'Introduce the complex technical concept or architecture being demystified.',
      'Present a familiar, intuitive real-world analogy.',
      'Map each component of the analogy directly to the technical system.',
      'Clarify where the analogy breaks down to avoid false mental models.',
      'Deliver a practical takeaway for how to think about it when building.'
    ],
    writingStyle: 'Visual, engaging, intuitive. Bridges abstract terminology into tangible, everyday understanding without condescension.',
    intents: ['technical_analogy', 'teach_concept']
  },
  {
    pillar: 'Value',
    name: 'Comparison',
    purpose: 'Compare two architectural approaches, tools, or techniques with objective trade-offs and decision criteria.',
    thinkingFlow: [
      'Introduce Approach A and its primary purpose.',
      'Introduce Approach B and its primary purpose.',
      'Highlight the single most important architectural or operational difference.',
      'Clarify the exact scenarios where Approach A makes sense.',
      'Clarify the exact scenarios where Approach B makes sense.',
      'Provide a definitive decision heuristic or takeaway.'
    ],
    writingStyle: 'Balanced, objective, and nuanced. Avoids generic "A vs B" superficial lists; focuses on real production trade-offs.',
    intents: ['compare']
  },

  // ── LEAD MAGNET ANATOMIES ────────────────────────────────────
  {
    pillar: 'Lead Magnet',
    name: 'Cheat Sheet',
    purpose: 'Deliver a high-density set of core rules or reference specs paired with an offer for the full resource.',
    thinkingFlow: [
      'Frame the recurring problem or cognitive overload engineers face.',
      'Provide a compact, high-value set of 3-5 core rules or cheat-sheet items.',
      'Introduce the complete cheat sheet / reference resource.',
      'Close with a clear, direct, non-salesy engagement CTA to get it.'
    ],
    writingStyle: 'High-density, punchy, scannable. Teases immediate practical value upfront so the reader knows the resource is worth having.',
    intents: ['resource_stack', 'checklist', 'template']
  },
  {
    pillar: 'Lead Magnet',
    name: 'Checklist',
    purpose: 'Provide a structured verification checklist to prevent critical oversights before or during execution.',
    thinkingFlow: [
      'Describe the high-stakes situation or task where mistakes are costly.',
      'Present the prioritized checklist items with concrete criteria.',
      'Briefly explain why each item is critical to operational success.',
      'Present the complete checklist resource/doc.',
      'Close with a frictionless CTA to claim the checklist.'
    ],
    writingStyle: 'Resource-first, organized, and rigorous. Clear bulleted checklist format followed by a clean action prompt.',
    intents: ['checklist']
  },
  {
    pillar: 'Lead Magnet',
    name: 'Roadmap',
    purpose: 'Outline a multi-stage progression from starting baseline to advanced implementation capability.',
    thinkingFlow: [
      'Define the starting baseline or common roadblock.',
      'Outline Step 1: Core Foundation and prerequisites.',
      'Outline Step 2: Implementation and integration build.',
      'Outline Step 3: Production hardening and optimization.',
      'Describe the final destination and capability unlocked.',
      'Offer the comprehensive roadmap guide via a natural CTA.'
    ],
    writingStyle: 'Structured progression, aspirational yet grounded in practical engineering stages.',
    intents: ['roadmap']
  },
  {
    pillar: 'Lead Magnet',
    name: 'Template',
    purpose: 'Offer a plug-and-play template, scaffold, or boilerplate that eliminates tedious setup work.',
    thinkingFlow: [
      'Identify what takes too much repetitive manual effort to configure from scratch.',
      'Summarize what is included in the template or starter scaffold.',
      'Show how easily it can be deployed or used in 2-3 steps.',
      'Share a concrete snippet or configuration preview.',
      'Close with a clear CTA to get access to the template.'
    ],
    writingStyle: 'Pragmatic, utility-focused. Emphasizes saved hours and clean design patterns.',
    intents: ['template']
  },
  {
    pillar: 'Lead Magnet',
    name: 'Decision Tree',
    purpose: 'Guide builders through branching choices to determine the optimal solution for their specific context.',
    thinkingFlow: [
      'Set the context of the technical dilemma or fork in the road.',
      'State the primary decision criterion or constraint.',
      'Trace Branch A vs Branch B based on scale, latency, or complexity.',
      'Highlight the next-order decision point.',
      'Deliver the final recommended path.',
      'Offer the full visual decision tree diagram via CTA.'
    ],
    writingStyle: 'Logic-driven, branching clarity. High utility for developers facing architectural choices.',
    intents: ['framework', 'checklist']
  },
  {
    pillar: 'Lead Magnet',
    name: 'Resource Stack',
    purpose: 'Curate a targeted collection of tools, repos, and documentation for a specific technical workflow.',
    thinkingFlow: [
      'Highlight the tooling fragmentation challenge for the specific domain.',
      'Present a vetted list of complementary resources/tools.',
      'State the exact role each tool plays in the workflow.',
      'Explain how they combine into a powerful stack.',
      'Offer the complete curated stack list and repository links via CTA.'
    ],
    writingStyle: 'Resource-first, naming real specific tools and repos, actionable synergy.',
    intents: ['resource_stack']
  },

  // ── AUTHORITY ANATOMIES ──────────────────────────────────────
  {
    pillar: 'Authority',
    name: 'Industry Observation',
    purpose: 'Build authority through an original interpretation of a current industry, startup, or technology pattern.',
    thinkingFlow: [
      'State the observation clearly: describe the pattern, shift, or anomaly you have noticed.',
      'Provide concrete evidence, company examples, startup data, or ecosystem signals.',
      'Explain why this pattern is happening right now (underlying economic, tech, or behavioral drivers).',
      'Deliver your original interpretation and synthesis of the situation.',
      'Conclude with the broader implication for practitioners, founders, or the industry.'
    ],
    writingStyle: 'Paragraph-led, analytical, and natural. Do NOT use numbered listicles or mechanical section headings. Let ideas flow in thoughtful prose.',
    intents: ['industry_observation', 'trend_analysis']
  },
  {
    pillar: 'Authority',
    name: 'Company Breakdown',
    purpose: 'Dissect an important strategic, architectural, or business model decision made by a real company.',
    thinkingFlow: [
      'Introduce the company and the specific context or dilemma they faced.',
      'Detail the important decision or bet they made.',
      'Analyze why they made it, including the trade-offs they accepted.',
      'Review the outcome or market effect of the decision.',
      'Synthesize what builders and technical teams can learn from their move.'
    ],
    writingStyle: 'Analytical, respectful critique, domain synthesis. Do NOT merely summarize company press releases; inject sharp, original engineering/business interpretation.',
    intents: ['company_analysis']
  },
  {
    pillar: 'Authority',
    name: 'Founder Lens',
    purpose: 'Examine a non-obvious bet or tactical philosophy through a founder\'s perspective.',
    thinkingFlow: [
      'Introduce the founder and the core problem they tackled.',
      'Highlight why conventional consensus failed or proved inadequate.',
      'Describe the non-obvious bet or strategy the founder chose.',
      'Review the result or operational milestone achieved.',
      'Extract the strategic lesson for engineering and product leaders.'
    ],
    writingStyle: 'Insightful narrative analysis grounded in public record. Focuses on decision logic and strategic courage rather than biography.',
    intents: ['founder_lens', 'company_analysis']
  },
  {
    pillar: 'Authority',
    name: 'Contrarian Opinion',
    purpose: 'Provide a thoughtful, evidence-backed challenge to common consensus without drama or cliches.',
    thinkingFlow: [
      'State the widely accepted industry consensus or best practice.',
      'Present your counter-thesis grounded in engineering experience or data.',
      'Lay out concrete evidence and deductive reasoning supporting your stance.',
      'Add nuance: acknowledge where the common wisdom still holds true.',
      'Conclude with the strategic shift in thinking you recommend.'
    ],
    writingStyle: 'Measured, rational, and nuanced. Strictly avoid dramatic reversal framing ("Everyone thinks X, but they are wrong"). Make the disagreement natural, polite, and deeply reasoned.',
    intents: ['contrarian_view']
  },
  {
    pillar: 'Authority',
    name: 'Trend Analysis',
    purpose: 'Trace an emerging technological or developer tooling shift and analyze its second-order effects.',
    thinkingFlow: [
      'Identify the emerging trend or tooling movement gaining momentum.',
      'Cite concrete examples of startups, tools, or repos driving it.',
      'Analyze what is fundamentally changing compared to previous approaches.',
      'Explain the technological catalyst or bottleneck that provoked the shift.',
      'Discuss the strategic implications for teams building in this space over the next 12-24 months.'
    ],
    writingStyle: 'Forward-looking, analytical, balanced, paragraph-led. Avoids hype words; focuses on technical mechanics and adoption signals.',
    intents: ['trend_analysis', 'industry_observation']
  },

  // ── SHOWCASE ANATOMIES ───────────────────────────────────────
  {
    pillar: 'Showcase',
    name: 'Build Story',
    purpose: 'Prove execution capability by detailing the journey of building a real feature, agent, or system.',
    thinkingFlow: [
      'State the concrete problem or user requirement that prompted the build.',
      'Explain the key architectural or implementation decision made.',
      'Walk through how the system was built and connected together.',
      'Share the concrete result, latency metric, accuracy benchmark, or operational outcome.',
      'Reflect on the technical lesson or principle learned from the build.'
    ],
    writingStyle: 'Engineering-grounded, candid, and authentic. Focuses on reasoning, real stack decisions (naming LangGraph, Postgres, etc.), and hard-won results without bragging.',
    intents: ['build_story', 'case_study']
  },
  {
    pillar: 'Showcase',
    name: 'Architecture Reveal',
    purpose: 'Demonstrate technical depth through a comprehensive architectural breakdown of a production system.',
    thinkingFlow: [
      'Define the system requirements and operational constraints.',
      'Present the overall architecture and primary components (agents, databases, caches).',
      'Explain why this specific architecture was chosen over alternative patterns.',
      'Detail the major technical trade-off accepted to achieve the goals.',
      'Summarize the resulting stability, latency, or throughput achieved.'
    ],
    writingStyle: 'High technical precision. Naming frameworks, state handling, and database schemas. Clear design rationale with zero fluff.',
    intents: ['architecture_explanation', 'technical_decision']
  },
  {
    pillar: 'Showcase',
    name: 'Before / After',
    purpose: 'Demonstrate measurable engineering impact by contrasting a legacy inefficient system with the redesigned stack.',
    thinkingFlow: [
      'Describe the old approach or legacy architecture and its limitations.',
      'Highlight the breaking point, scaling bottleneck, or high latency it caused.',
      'Introduce the new redesigned system and its core innovations.',
      'Highlight the measurable improvements (e.g. latency reduced by 40%, memory usage slashed).',
      'Extract the fundamental design lesson proven by the migration.'
    ],
    writingStyle: 'Stark engineering contrast, backed by measurable numbers and real operational impact.',
    intents: ['before_after', 'case_study']
  },
  {
    pillar: 'Showcase',
    name: 'Build Failure',
    purpose: 'Build trust and credibility by transparently dissecting an engineering failure encountered during development.',
    thinkingFlow: [
      'Describe what you set out to build and the initial hypothesis tested.',
      'Detail how the system broke, failed to scale, or threw unexpected edge cases.',
      'Diagnose the root cause discovered after debugging deep into the stack.',
      'Explain the fix, refactor, or architectural pivot that permanently solved it.',
      'Conclude with the hard-won engineering rule or mental model gained.'
    ],
    writingStyle: 'Transparent, analytical post-mortem tone. Humble, educational, and showcasing deep debugging competence.',
    intents: ['technical_decision', 'build_story']
  },
  {
    pillar: 'Showcase',
    name: 'Demo Narrative',
    purpose: 'Take the reader through a live user interaction and reveal the sophisticated engineering behind the scenes.',
    thinkingFlow: [
      'Set the stage: what problem the user is attempting to solve in the application.',
      'Describe the user interaction or input trigger.',
      'Reveal what happens behind the scenes across agents, queries, vector retrieval, and state.',
      'Show the final accurate result returned to the user.',
      'Summarize the engineering principle that makes the seamless experience possible.'
    ],
    writingStyle: 'Engaging workflow narrative. Illustrates complex backend orchestration through an intuitive, observable scenario.',
    intents: ['build_story', 'case_study']
  }
];
