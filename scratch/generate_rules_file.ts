import fs from 'fs';
import path from 'path';
import { getDb } from '../lib/db';

const db = getDb();

const postTypes = db.prepare('SELECT * FROM post_types ORDER BY name ASC').all() as any[];
const contentIntents = db.prepare('SELECT * FROM content_intents ORDER BY priority ASC, name ASC').all() as any[];
const postAnatomy = db.prepare("SELECT * FROM post_anatomy WHERE entity_type = 'anatomy' ORDER BY order_index ASC").all() as any[];
const anatomyIntents = db.prepare('SELECT * FROM anatomy_intents').all() as any[];
const postComponents = db.prepare(`
  SELECT * FROM post_components
  ORDER BY CASE name
    WHEN 'Hook' THEN 0
    WHEN 'Context' THEN 1
    WHEN 'Body' THEN 2
    WHEN 'CTA' THEN 3
    WHEN 'Visual Suggestion' THEN 4
  END
`).all() as any[];
const writingMechanics = db.prepare('SELECT * FROM writing_mechanics WHERE enabled = 1 ORDER BY order_index ASC').all() as any[];
const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
const hookTypes = db.prepare('SELECT * FROM hook_types ORDER BY name ASC').all() as any[];

let markdown = `# LinkedIn Content OS — Master Strategy Rules & Content Specifications

This file contains the complete, authoritative specification of all 5 LinkedIn content pillars, their mapped Content Intents, Thinking Flow Anatomies, Hook Formulas, and Global System Writing Mechanics as configured in the system database.

---

`;

postTypes.forEach(pt => {
  const dos = JSON.parse(pt.dos || '[]');
  const donts = JSON.parse(pt.donts || '[]');
  let visuals: string[] = [];
  try {
    const parsed = JSON.parse(pt.visual_suggestions || '[]');
    visuals = Array.isArray(parsed) ? parsed : [String(pt.visual_suggestions)];
  } catch {
    visuals = pt.visual_suggestions ? [pt.visual_suggestions] : [];
  }

  markdown += `# Pillar: ${pt.name}\n\n`;
  markdown += `## 1. Pillar Overview & Core Focus\n${pt.core_focus}\n\n`;

  markdown += `## 2. DOs\n`;
  dos.forEach((d: string) => { markdown += `- ${d}\n`; });
  markdown += `\n`;

  markdown += `## 3. DON'Ts\n`;
  donts.forEach((d: string) => { markdown += `- ${d}\n`; });
  markdown += `\n`;

  if (visuals.length > 0) {
    markdown += `## 4. Visual Guidance\n`;
    visuals.forEach(v => { markdown += `- ${v}\n`; });
    markdown += `\n`;
  }

  // Mapped Content Intents
  const intentsForPillar = contentIntents.filter(ci => ci.post_type_id === pt.id);
  markdown += `## 5. Content Intents (${intentsForPillar.length})\n\n`;
  intentsForPillar.forEach(ci => {
    markdown += `### Intent: ${ci.display_name} (\`${ci.name}\`)\n`;
    markdown += `- **Description**: ${ci.description}\n`;
    markdown += `- **Priority**: ${ci.priority}\n`;
    markdown += `- **Default Fallback for Pillar**: ${ci.is_default ? 'Yes (Primary Default)' : 'No'}\n\n`;
  });

  // Mapped Anatomies
  const anatomiesForPillar = postAnatomy.filter(pa => pa.post_type_id === pt.id || pa.applies_to_post_type_id === pt.id);
  markdown += `## 6. Thinking Flow Anatomies (${anatomiesForPillar.length})\n\n`;

  anatomiesForPillar.forEach(anat => {
    let steps: unknown[] = [];
    try {
      steps = JSON.parse(anat.thinking_flow || '[]');
    } catch {
      steps = anat.thinking_flow ? [anat.thinking_flow] : [];
    }

    // Find mapped intents via junction
    const mappedIntentIds = anatomyIntents.filter(ai => ai.anatomy_id === anat.id).map(ai => ai.intent_id);
    const mappedIntentNames = contentIntents.filter(ci => mappedIntentIds.includes(ci.id)).map(ci => ci.display_name);

    markdown += `### Anatomy: ${anat.name || anat.section_name}\n`;
    markdown += `- **Purpose**: ${anat.purpose || 'N/A'}\n`;
    if (mappedIntentNames.length > 0) {
      markdown += `- **Mapped Intents**: ${mappedIntentNames.join(', ')}\n`;
    }
    markdown += `- **Thinking Flow (Mental Model Steps)**:\n`;
    steps.forEach((step, idx) => {
      const stepObject = step as { name?: string; instruction?: string; purpose?: string };
      const rendered = typeof step === 'string' ? step : `${stepObject.name || 'Step'}: ${stepObject.instruction || ''}${stepObject.purpose ? ` (${stepObject.purpose})` : ''}`;
      markdown += `  ${idx + 1}. ${rendered}\n`;
    });
    if (anat.writing_style) {
      markdown += `- **Writing Style Directives**: ${anat.writing_style}\n`;
    }
    if (anat.constraints) {
      markdown += `- **Constraints**: ${anat.constraints}\n`;
    }
    markdown += `\n`;
  });

  // Mapped Hook Types
  const hooksForPillar = hookTypes.filter(ht => {
    try {
      const pillars = JSON.parse(ht.best_fit_pillars || '[]');
      return pillars.includes(pt.name);
    } catch {
      return false;
    }
  });

  markdown += `## 7. Best-Fit Hook Formulas (${hooksForPillar.length})\n\n`;
  hooksForPillar.forEach(ht => {
    let angles: string[] = [];
    try { angles = JSON.parse(ht.angles || '[]'); } catch { angles = []; }
    markdown += `### Hook: ${ht.name}\n`;
    if (ht.description) markdown += `- **Description**: ${ht.description}\n`;
    if (angles.length > 0) {
      markdown += `- **Angles / Entry Formulas**:\n`;
      angles.forEach(a => { markdown += `  - ${a}\n`; });
    }
    markdown += `\n`;
  });

  markdown += `---\n\n`;
});

// System Mechanics & Global Directives
markdown += `# Global Writing Mechanics & System Directives\n\n`;

markdown += `## Universal Post Components (Global Order)\n\n`;
postComponents.forEach((component: any) => {
  markdown += `- **${component.name}**: ${component.instructions}\n`;
});
markdown += `\n`;

markdown += `## 1. Writing Mechanics Directives (DB Configured)\n\n`;
writingMechanics.forEach(wm => {
  markdown += `### ${wm.order_index}. ${wm.rule_name}\n`;
  markdown += `- **Description**: ${wm.description}\n`;
  markdown += `- **Prompt Directive**: ${wm.prompt_directive}\n\n`;
});

const toneRaw = settings?.tone_profile ? JSON.parse(settings.tone_profile) : {};

markdown += `## 2. Global Tone & Voice Profile\n\n`;
markdown += `- **Formality**: ${toneRaw.formality || 'mixed'}\n`;
markdown += `- **Sentence Length**: ${toneRaw.sentenceLength || 'short'}\n`;
markdown += `- **Language Mix**: ${toneRaw.languageMix || 'Clear, professional English'}\n`;
markdown += `- **Vocabulary Level**: ${toneRaw.vocabularyLevel || 'simple'}\n`;

if (toneRaw.bannedPhrases && toneRaw.bannedPhrases.length > 0) {
  markdown += `- **Banned Cliche Phrases**:\n`;
  toneRaw.bannedPhrases.forEach((p: string) => { markdown += `  - "${p}"\n`; });
}

if (toneRaw.avoidWords && toneRaw.avoidWords.length > 0) {
  markdown += `- **Banned Formal Essay Vocabulary (Strict Avoid Words)**:\n`;
  markdown += `  ${toneRaw.avoidWords.join(', ')}\n`;
}
markdown += `\n`;

markdown += `## 3. Strict Writing Restrictions & Negative Directives\n\n`;
markdown += `- **No Reversal Framing**: Never use "Most people think X. But X is wrong."\n`;
markdown += `- **No Rhetorical Questions**: Avoid opening or peppering posts with rhetorical questions.\n`;
markdown += `- **No Generic Dramatic Opening**: Avoid "Most developers..." or "Most engineers..."\n`;
markdown += `- **No Excessive Fragment Stacking**: Maintain natural sentence rhythm; avoid 10 single-word lines stacked consecutively.\n`;
markdown += `- **No Forced Summary or CTA**: Omit CTAs or keep them subtle when not natural for the pillar/anatomy.\n`;
markdown += `- **No Visible Template Headings**: Never output mechanical section headers (e.g., \`Observation:\`, \`Evidence:\`, \`Why:\`). Write fluid natural paragraphs.\n`;
markdown += `- **Anti-Fabrication Directive**: Never manufacture numbers, fake metrics, fake founder quotes, or imaginary results.\n`;
markdown += `- **No Em Dashes**: Avoid em dashes (\`—\`). Use simple everyday punctuation.\n\n`;

markdown += `## 4. Target Post Format Specifications & Character Limits\n\n`;
markdown += `- **Text Post**: 600–1,200 characters (~100–200 words). Focused, scannable educational or narrative prose.\n`;
markdown += `- **Image Post**: 900–1,500 characters (~150–250 words). Paired with structured diagram or screenshot.\n`;
markdown += `- **Carousel**: 1,200–1,500 characters (~200–260 words). Slide-by-slide scannable breakdown.\n`;
markdown += `- **Video Post**: 500–800 characters (~80–130 words). Short, punchy script outline.\n\n`;

markdown += `## 5. End-to-End System Pipeline Hierarchy\n\n`;
markdown += `\`\`\`text\n`;
markdown += `RAW NOTES / USER IDEA\n`;
markdown += `        ↓\n`;
markdown += `     PILLAR (Value, Lead Magnet, Authority, Personal, Showcase)\n`;
markdown += `        ↓\n`;
markdown += `  CONTENT INTENT (Deterministically resolved from semantic notes signals; 0 extra LLM call)\n`;
markdown += `        ↓\n`;
markdown += `ELIGIBLE ANATOMIES (Filtered by Pillar + Intent via anatomy_intents)\n`;
markdown += `        ↓\n`;
markdown += `  ANATOMY (Explicitly selected Anatomy, or first eligible fallback)\n`;
markdown += `        ↓\n`;
markdown += `    HOOK TYPE POOL (Top 5 configured hook formulas matching pillar)\n`;
markdown += `        ↓\n`;
markdown += ` DYNAMIC PROMPT ASSEMBLY (backend combines selected context and universal writing preferences)\n`;
markdown += `        ↓\n`;
markdown += `      GEMINI (gemini-3.6-flash generates 3 versions with shared thinking flow & distinct angles/hooks)\n`;
markdown += `        ↓\n`;
markdown += `    VALIDATION (JSON structure, character limits, 3 versions, tone bans, strips visible section labels)\n`;
markdown += `        ↓\n`;
markdown += `OUTPUT & PREVIEW (Studio editor with expandable Thinking Journey blueprint)\n`;
markdown += `\`\`\`\n`;

const targetPath = path.join(process.cwd(), 'rules.md');
fs.writeFileSync(targetPath, markdown, 'utf8');
console.log('Successfully written rules.md at:', targetPath);
