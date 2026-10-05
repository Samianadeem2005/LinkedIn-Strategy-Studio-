export interface ValidatedVersion {
  version: number;
  hookType?: string;
  angle?: string;
  content: string;
  sections?: Record<string, string>;
  visualSuggestion?: string;
  resources?: string[];
  characterCount: number;
}

export interface ValidationReport {
  isValid: boolean;
  versions: ValidatedVersion[];
  warnings: string[];
  errors: string[];
}

/**
 * Common anatomy labels that must NOT appear as visible headings in the generated post.
 */
const FORBIDDEN_LABEL_PATTERNS = [
  /^(?:Hook|Rehook|Context|Breakdown|CTA|Nudge|Pivot|Lesson)\s*:\s*/im,
  /^(?:Observation|Evidence|Why it happens|Why this is happening|Interpretation|Implication)\s*:\s*/im,
  /^(?:Common misconception|Actual reality|Explanation|Practical implication)\s*:\s*/im,
  /^(?:Problem|Why|Fix|Practical example)\s*:\s*/im,
  /^(?:Technical concept|Analogy|Takeaway|Decision takeaway)\s*:\s*/im,
  /^(?:Approach A|Approach B|Important difference|When A makes sense|When B makes sense)\s*:\s*/im,
  /^(?:Situation|Checklist|Roadmap|Template|Decision point|Resource)\s*:\s*/im,
  /^(?:Moment|What I thought|What happened|Realization|What changed)\s*:\s*/im,
  /^(?:Expectation|Failure|Why it failed|What I misunderstood|New approach)\s*:\s*/im,
  /^(?:Old approach|New system|Improvement|Build|Architecture|Tradeoff|Result)\s*:\s*/im,
  /^(?:Thinking Flow|Thinking Journey|Writing Style)\s*:\s*/im
];

/**
 * Strips visible section labels if the LLM accidentally prefix-labeled a paragraph.
 * E.g., "Observation: I noticed that..." -> "I noticed that..."
 */
export function sanitizeVisibleAnatomyHeadings(text: string): { cleaned: string; strippedLabels: string[] } {
  const strippedLabels: string[] = [];
  const lines = text.split('\n');
  const cleanedLines = lines.map(line => {
    let modified = line;
    for (const pattern of FORBIDDEN_LABEL_PATTERNS) {
      const match = modified.match(pattern);
      if (match) {
        strippedLabels.push(match[0].replace(/:\s*$/, '').trim());
        modified = modified.replace(pattern, '').trim();
      }
    }
    return modified;
  });

  return {
    cleaned: cleanedLines.join('\n'),
    strippedLabels: Array.from(new Set(strippedLabels))
  };
}

/**
 * Validates generated versions, ensures hook diversity, verifies character limits,
 * strips illegal anatomy headings, and checks for banned tropes.
 */
export function validatePostGeneration(
  rawParsed: any,
  formatConstraints: { name: string; min: number; max: number },
  bannedPhrases: string[] = [],
  avoidWords: string[] = []
): ValidationReport {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!rawParsed || typeof rawParsed !== 'object') {
    return {
      isValid: false,
      versions: [],
      warnings: [],
      errors: ['Generated response is not a valid JSON object.']
    };
  }

  const rawVersions = Array.isArray(rawParsed.versions) ? rawParsed.versions : [];
  if (rawVersions.length === 0) {
    return {
      isValid: false,
      versions: [],
      warnings: [],
      errors: ['No versions found in generated response.']
    };
  }

  if (rawVersions.length !== 3) {
    warnings.push(`Expected 3 versions, but received ${rawVersions.length}.`);
  }

  const validatedVersions: ValidatedVersion[] = [];
  const hookTypesUsed: string[] = [];

  for (let i = 0; i < rawVersions.length; i++) {
    const rawV = rawVersions[i];
    const vNum = typeof rawV.version === 'number' ? rawV.version : i + 1;

    // Extract text content: either 'content' field or combined 'sections'
    let textContent = '';
    if (typeof rawV.content === 'string' && rawV.content.trim()) {
      textContent = rawV.content.trim();
    } else if (rawV.sections && typeof rawV.sections === 'object') {
      if (typeof rawV.sections.Content === 'string') {
        textContent = rawV.sections.Content.trim();
      } else {
        textContent = Object.values(rawV.sections)
          .filter(val => typeof val === 'string' && val.trim())
          .map(val => (val as string).trim())
          .join('\n\n');
      }
    }

    // Clean any accidental visible anatomy headings
    const { cleaned, strippedLabels } = sanitizeVisibleAnatomyHeadings(textContent);
    if (strippedLabels.length > 0) {
      warnings.push(`Version ${vNum}: Automatically removed visible anatomy headings (${strippedLabels.join(', ')}).`);
    }

    const charCount = cleaned.length;

    // Check character count bounds with soft tolerance
    if (charCount < formatConstraints.min * 0.85) {
      warnings.push(`Version ${vNum} is slightly short (${charCount} chars, target min: ${formatConstraints.min}).`);
    } else if (charCount > formatConstraints.max * 1.15) {
      warnings.push(`Version ${vNum} is slightly long (${charCount} chars, target max: ${formatConstraints.max}).`);
    }

    // Track hook diversity
    const hookName = (rawV.hookType || rawV.hook_type || rawV.angle || '').trim();
    if (hookName) {
      hookTypesUsed.push(hookName.toLowerCase());
    }

    // Check banned phrases
    const lowerText = cleaned.toLowerCase();
    for (const phrase of bannedPhrases) {
      if (phrase && phrase.length > 2 && lowerText.includes(phrase.toLowerCase())) {
        warnings.push(`Version ${vNum} contains discouraged phrase: "${phrase}".`);
      }
    }

    // Resources sanitation
    const resourcesList = Array.isArray(rawV.resources)
      ? rawV.resources.map((r: any) => String(r).trim()).filter(Boolean)
      : [];

    validatedVersions.push({
      version: vNum,
      hookType: rawV.hookType || rawV.hook_type || undefined,
      angle: rawV.angle || undefined,
      content: cleaned,
      sections: {
        Content: cleaned,
        ...(rawV.sections && typeof rawV.sections === 'object' ? rawV.sections : {})
      },
      visualSuggestion: typeof rawV.visualSuggestion === 'string' ? rawV.visualSuggestion : (rawV.visual_suggestion || ''),
      resources: resourcesList,
      characterCount: charCount
    });
  }

  // Hook Diversity Check
  if (hookTypesUsed.length >= 2) {
    const uniqueHooks = new Set(hookTypesUsed);
    if (uniqueHooks.size === 1) {
      warnings.push('All generated versions used the same hook type. Ensure distinct angles.');
    }
  }

  // Meaningful divergence check (are versions just identical text?)
  if (validatedVersions.length >= 2) {
    const text1 = validatedVersions[0].content;
    const text2 = validatedVersions[1].content;
    if (text1 === text2) {
      warnings.push('Version 1 and Version 2 are identical.');
    }
  }

  return {
    isValid: errors.length === 0,
    versions: validatedVersions,
    warnings,
    errors
  };
}
