/**
 * LinkedIn Unicode Text Formatter & Font Converter Utility
 * Maps standard ASCII characters to Unicode mathematical fonts and combining marks.
 * Supports multi-formatting (combining Bold, Italic, Underline, Strikethrough, and Font styles).
 */

export interface CharInfo {
  base: string;
  bold: boolean;
  italic: boolean;
  sans: boolean;
  script: boolean;
  doubleStruck: boolean;
  monospace: boolean;
  fullwidth: boolean;
  underline: boolean;
  strikethrough: boolean;
}

const SCRIPT_EXCEPTIONS: Record<string, string> = {
  'B': 'ℬ', 'E': 'ℰ', 'F': 'ℱ', 'H': 'ℋ', 'I': 'ℐ', 'L': 'ℒ', 'M': 'ℳ', 'R': 'ℛ',
  'e': 'ℯ', 'g': 'ℊ', 'o': 'ℴ',
};

const DOUBLESTRUCK_EXCEPTIONS: Record<string, string> = {
  'C': 'ℂ', 'H': 'ℍ', 'N': 'ℕ', 'P': 'ℙ', 'Q': 'ℚ', 'R': 'ℝ', 'Z': 'ℤ',
};

export function parseString(text: string): CharInfo[] {
  const result: CharInfo[] = [];
  let i = 0;
  while (i < text.length) {
    const cp = text.codePointAt(i) || 0;
    const rawChar = String.fromCodePoint(cp);

    // Combining underline
    if (cp === 0x0332) {
      if (result.length > 0) result[result.length - 1].underline = true;
      i += 1;
      continue;
    }
    // Combining strikethrough
    if (cp === 0x0335 || cp === 0x0336) {
      if (result.length > 0) result[result.length - 1].strikethrough = true;
      i += 1;
      continue;
    }

    const charLen = cp > 0xffff ? 2 : 1;
    i += charLen;

    let base = rawChar;
    let bold = false;
    let italic = false;
    let sans = false; // default base sans is false unless matched
    let script = false;
    let doubleStruck = false;
    let monospace = false;
    let fullwidth = false;

    // Exceptions
    if (rawChar === 'ℎ') { base = 'h'; italic = true; sans = false; }
    else if (rawChar === 'ℬ') { base = 'B'; script = true; }
    else if (rawChar === 'ℰ') { base = 'E'; script = true; }
    else if (rawChar === 'ℱ') { base = 'F'; script = true; }
    else if (rawChar === 'ℋ') { base = 'H'; script = true; }
    else if (rawChar === 'ℐ') { base = 'I'; script = true; }
    else if (rawChar === 'ℒ') { base = 'L'; script = true; }
    else if (rawChar === 'ℳ') { base = 'M'; script = true; }
    else if (rawChar === 'ℛ') { base = 'R'; script = true; }
    else if (rawChar === 'ℯ') { base = 'e'; script = true; }
    else if (rawChar === 'ℊ') { base = 'g'; script = true; }
    else if (rawChar === 'ℴ') { base = 'o'; script = true; }
    else if (rawChar === 'ℂ') { base = 'C'; doubleStruck = true; }
    else if (rawChar === 'ℍ') { base = 'H'; doubleStruck = true; }
    else if (rawChar === 'ℕ') { base = 'N'; doubleStruck = true; }
    else if (rawChar === 'ℙ') { base = 'P'; doubleStruck = true; }
    else if (rawChar === 'ℚ') { base = 'Q'; doubleStruck = true; }
    else if (rawChar === 'ℝ') { base = 'R'; doubleStruck = true; }
    else if (rawChar === 'ℤ') { base = 'Z'; doubleStruck = true; }
    // Bold Serif
    else if (cp >= 0x1d400 && cp <= 0x1d419) { base = String.fromCharCode(0x41 + (cp - 0x1d400)); bold = true; sans = false; }
    else if (cp >= 0x1d41a && cp <= 0x1d433) { base = String.fromCharCode(0x61 + (cp - 0x1d41a)); bold = true; sans = false; }
    else if (cp >= 0x1d7ce && cp <= 0x1d7d7) { base = String.fromCharCode(0x30 + (cp - 0x1d7ce)); bold = true; sans = false; }
    // Bold Sans
    else if (cp >= 0x1d5d4 && cp <= 0x1d5ed) { base = String.fromCharCode(0x41 + (cp - 0x1d5d4)); bold = true; sans = true; }
    else if (cp >= 0x1d5ee && cp <= 0x1d607) { base = String.fromCharCode(0x61 + (cp - 0x1d5ee)); bold = true; sans = true; }
    else if (cp >= 0x1d7ec && cp <= 0x1d7f5) { base = String.fromCharCode(0x30 + (cp - 0x1d7ec)); bold = true; sans = true; }
    // Italic Serif
    else if (cp >= 0x1d434 && cp <= 0x1d44d) { base = String.fromCharCode(0x41 + (cp - 0x1d434)); italic = true; sans = false; }
    else if (cp >= 0x1d44e && cp <= 0x1d467) { base = String.fromCharCode(0x61 + (cp - 0x1d44e)); italic = true; sans = false; }
    // Italic Sans
    else if (cp >= 0x1d608 && cp <= 0x1d621) { base = String.fromCharCode(0x41 + (cp - 0x1d608)); italic = true; sans = true; }
    else if (cp >= 0x1d622 && cp <= 0x1d63b) { base = String.fromCharCode(0x61 + (cp - 0x1d622)); italic = true; sans = true; }
    // Bold Italic Serif
    else if (cp >= 0x1d468 && cp <= 0x1d481) { base = String.fromCharCode(0x41 + (cp - 0x1d468)); bold = true; italic = true; sans = false; }
    else if (cp >= 0x1d482 && cp <= 0x1d49b) { base = String.fromCharCode(0x61 + (cp - 0x1d482)); bold = true; italic = true; sans = false; }
    // Bold Italic Sans
    else if (cp >= 0x1d63c && cp <= 0x1d655) { base = String.fromCharCode(0x41 + (cp - 0x1d63c)); bold = true; italic = true; sans = true; }
    else if (cp >= 0x1d656 && cp <= 0x1d66f) { base = String.fromCharCode(0x61 + (cp - 0x1d656)); bold = true; italic = true; sans = true; }
    // Sans Regular
    else if (cp >= 0x1d5a0 && cp <= 0x1d5b9) { base = String.fromCharCode(0x41 + (cp - 0x1d5a0)); sans = true; }
    else if (cp >= 0x1d5ba && cp <= 0x1d5d3) { base = String.fromCharCode(0x61 + (cp - 0x1d5ba)); sans = true; }
    else if (cp >= 0x1d7e2 && cp <= 0x1d7eb) { base = String.fromCharCode(0x30 + (cp - 0x1d7e2)); sans = true; }
    // Monospace
    else if (cp >= 0x1d670 && cp <= 0x1d689) { base = String.fromCharCode(0x41 + (cp - 0x1d670)); monospace = true; }
    else if (cp >= 0x1d68a && cp <= 0x1d6a3) { base = String.fromCharCode(0x61 + (cp - 0x1d68a)); monospace = true; }
    else if (cp >= 0x1d7f6 && cp <= 0x1d7ff) { base = String.fromCharCode(0x30 + (cp - 0x1d7f6)); monospace = true; }
    // Script
    else if (cp >= 0x1d49c && cp <= 0x1d4b5) { base = String.fromCharCode(0x41 + (cp - 0x1d49c)); script = true; }
    else if (cp >= 0x1d4b6 && cp <= 0x1d4cf) { base = String.fromCharCode(0x61 + (cp - 0x1d4b6)); script = true; }
    // DoubleStruck
    else if (cp >= 0x1d538 && cp <= 0x1d551) { base = String.fromCharCode(0x41 + (cp - 0x1d538)); doubleStruck = true; }
    else if (cp >= 0x1d552 && cp <= 0x1d56b) { base = String.fromCharCode(0x61 + (cp - 0x1d552)); doubleStruck = true; }
    else if (cp >= 0x1d7d8 && cp <= 0x1d7e1) { base = String.fromCharCode(0x30 + (cp - 0x1d7d8)); doubleStruck = true; }
    // Fullwidth
    else if (cp >= 0xff01 && cp <= 0xff5e) { base = String.fromCharCode(0x21 + (cp - 0xff01)); fullwidth = true; }

    result.push({
      base,
      bold,
      italic,
      sans,
      script,
      doubleStruck,
      monospace,
      fullwidth,
      underline: false,
      strikethrough: false
    });
  }
  return result;
}

export function encodeChar(info: CharInfo): string {
  let result = info.base;
  const cp = info.base.charCodeAt(0);
  const isUpper = cp >= 0x41 && cp <= 0x5a;
  const isLower = cp >= 0x61 && cp <= 0x7a;
  const isDigit = cp >= 0x30 && cp <= 0x39;

  if (info.fullwidth) {
    if (info.base === ' ') {
      result = '　';
    } else if (cp >= 0x21 && cp <= 0x7e) {
      result = String.fromCodePoint(0xff01 + (cp - 0x21));
    }
  } else if (info.doubleStruck) {
    if (DOUBLESTRUCK_EXCEPTIONS[info.base]) {
      result = DOUBLESTRUCK_EXCEPTIONS[info.base];
    } else if (isUpper) {
      result = String.fromCodePoint(0x1d538 + (cp - 0x41));
    } else if (isLower) {
      result = String.fromCodePoint(0x1d552 + (cp - 0x61));
    } else if (isDigit) {
      result = String.fromCodePoint(0x1d7d8 + (cp - 0x30));
    }
  } else if (info.script && (isUpper || isLower)) {
    if (SCRIPT_EXCEPTIONS[info.base]) {
      result = SCRIPT_EXCEPTIONS[info.base];
    } else if (isUpper) {
      result = String.fromCodePoint(0x1d49c + (cp - 0x41));
    } else if (isLower) {
      result = String.fromCodePoint(0x1d4b6 + (cp - 0x61));
    }
  } else if (info.monospace && (isUpper || isLower || isDigit)) {
    if (isUpper) result = String.fromCodePoint(0x1d670 + (cp - 0x41));
    else if (isLower) result = String.fromCodePoint(0x1d68a + (cp - 0x61));
    else if (isDigit) result = String.fromCodePoint(0x1d7f6 + (cp - 0x30));
  } else if (isUpper || isLower || isDigit) {
    if (info.bold && info.italic) {
      if (info.sans) {
        if (isUpper) result = String.fromCodePoint(0x1d63c + (cp - 0x41));
        else if (isLower) result = String.fromCodePoint(0x1d656 + (cp - 0x61));
        else result = info.base;
      } else {
        if (isUpper) result = String.fromCodePoint(0x1d468 + (cp - 0x41));
        else if (isLower) result = String.fromCodePoint(0x1d482 + (cp - 0x61));
        else result = info.base;
      }
    } else if (info.bold) {
      if (info.sans) {
        if (isUpper) result = String.fromCodePoint(0x1d5d4 + (cp - 0x41));
        else if (isLower) result = String.fromCodePoint(0x1d5ee + (cp - 0x61));
        else if (isDigit) result = String.fromCodePoint(0x1d7ec + (cp - 0x30));
      } else {
        if (isUpper) result = String.fromCodePoint(0x1d400 + (cp - 0x41));
        else if (isLower) result = String.fromCodePoint(0x1d41a + (cp - 0x61));
        else if (isDigit) result = String.fromCodePoint(0x1d7ce + (cp - 0x30));
      }
    } else if (info.italic) {
      if (info.sans) {
        if (isUpper) result = String.fromCodePoint(0x1d608 + (cp - 0x41));
        else if (isLower) result = String.fromCodePoint(0x1d622 + (cp - 0x61));
        else result = info.base;
      } else {
        if (info.base === 'h') result = 'ℎ';
        else if (isUpper) result = String.fromCodePoint(0x1d434 + (cp - 0x41));
        else if (isLower) result = String.fromCodePoint(0x1d44e + (cp - 0x61));
        else result = info.base;
      }
    } else if (info.sans) {
      if (isUpper) result = String.fromCodePoint(0x1d5a0 + (cp - 0x41));
      else if (isLower) result = String.fromCodePoint(0x1d5ba + (cp - 0x61));
      else if (isDigit) result = String.fromCodePoint(0x1d7e2 + (cp - 0x30));
    }
  }

  if (info.underline && result !== '\n') {
    result += '\u0332';
  }
  if (info.strikethrough && result !== '\n') {
    result += '\u0335';
  }

  return result;
}

// ── Multi-formatting Toggle Helpers ─────────────────────────────────────

export function toggleBold(text: string): string {
  const chars = parseString(text);
  const letterChars = chars.filter(c => /[a-zA-Z0-9]/.test(c.base));
  const allBold = letterChars.length > 0 && letterChars.every(c => c.bold);

  return chars.map(c => {
    if (/[a-zA-Z0-9]/.test(c.base)) {
      return encodeChar({
        ...c,
        bold: !allBold,
        script: false,
        doubleStruck: false,
        monospace: false,
        fullwidth: false
      });
    }
    return encodeChar(c);
  }).join('');
}

export function toggleItalic(text: string): string {
  const chars = parseString(text);
  const letterChars = chars.filter(c => /[a-zA-Z]/.test(c.base));
  const allItalic = letterChars.length > 0 && letterChars.every(c => c.italic);

  return chars.map(c => {
    if (/[a-zA-Z]/.test(c.base)) {
      return encodeChar({
        ...c,
        italic: !allItalic,
        script: false,
        doubleStruck: false,
        monospace: false,
        fullwidth: false
      });
    }
    return encodeChar(c);
  }).join('');
}

export function toggleUnderline(text: string): string {
  const chars = parseString(text);
  const allUnderlined = chars.length > 0 && chars.every(c => c.underline);

  return chars.map(c => {
    return encodeChar({
      ...c,
      underline: !allUnderlined
    });
  }).join('');
}

export function toggleStrikethrough(text: string): string {
  const chars = parseString(text);
  const allStrikethrough = chars.length > 0 && chars.every(c => c.strikethrough);

  return chars.map(c => {
    return encodeChar({
      ...c,
      strikethrough: !allStrikethrough
    });
  }).join('');
}

export function applyFontToText(text: string, fontId: string): string {
  const chars = parseString(text);
  return chars.map(c => {
    let bold = c.bold;
    let italic = c.italic;
    let sans = c.sans;
    let script = false;
    let doubleStruck = false;
    let monospace = false;
    let fullwidth = false;

    switch (fontId) {
      case 'normal':
        bold = false; italic = false; sans = false; break;
      case 'bold':
        bold = true; italic = false; sans = false; break;
      case 'bold_sans':
        bold = true; italic = false; sans = true; break;
      case 'italic':
        bold = false; italic = true; sans = false; break;
      case 'italic_sans':
        bold = false; italic = true; sans = true; break;
      case 'bold_italic':
        bold = true; italic = true; sans = false; break;
      case 'bold_italic_sans':
        bold = true; italic = true; sans = true; break;
      case 'sans':
        bold = false; italic = false; sans = true; break;
      case 'script':
        bold = false; italic = false; script = true; break;
      case 'doublestruck':
        bold = false; italic = false; doubleStruck = true; break;
      case 'monospace':
        bold = false; italic = false; monospace = true; break;
      case 'fullwidth':
        bold = false; italic = false; fullwidth = true; break;
    }

    return encodeChar({
      ...c,
      bold,
      italic,
      sans,
      script,
      doubleStruck,
      monospace,
      fullwidth
    });
  }).join('');
}

// ── Standard Transformers ──────────────────────────────────────────────

export function toBoldSerif(text: string): string { return applyFontToText(text, 'bold'); }
export function toBoldSans(text: string): string { return applyFontToText(text, 'bold_sans'); }
export function toItalicSerif(text: string): string { return applyFontToText(text, 'italic'); }
export function toItalicSans(text: string): string { return applyFontToText(text, 'italic_sans'); }
export function toBoldItalicSerif(text: string): string { return applyFontToText(text, 'bold_italic'); }
export function toBoldItalicSans(text: string): string { return applyFontToText(text, 'bold_italic_sans'); }
export function toSans(text: string): string { return applyFontToText(text, 'sans'); }
export function toScript(text: string): string { return applyFontToText(text, 'script'); }
export function toDoubleStruck(text: string): string { return applyFontToText(text, 'doublestruck'); }
export function toMonospace(text: string): string { return applyFontToText(text, 'monospace'); }

export function toUnderline(text: string): string { return toggleUnderline(text); }
export function toStrikethrough(text: string): string { return toggleStrikethrough(text); }
export function toBoldUnderline(text: string): string {
  const chars = parseString(text);
  return chars.map(c => encodeChar({ ...c, bold: true, sans: true, underline: true })).join('');
}
export function toBoldStrikethrough(text: string): string {
  const chars = parseString(text);
  return chars.map(c => encodeChar({ ...c, bold: true, sans: true, strikethrough: true })).join('');
}

export function toFullwidth(text: string): string { return applyFontToText(text, 'fullwidth'); }
export function toUppercase(text: string): string { return text.toUpperCase(); }
export function toLowercase(text: string): string { return text.toLowerCase(); }

export function toNumberedList(text: string): string {
  const lines = text.split('\n');
  let count = 1;
  return lines
    .map(line => {
      const trimmed = line.replace(/^(\d+\.\s+|•\s+|☐\s+|\[\s*\]\s*)/, '');
      return `${count++}. ${trimmed}`;
    })
    .join('\n');
}

export function toBulletList(text: string): string {
  const lines = text.split('\n');
  return lines
    .map(line => {
      const trimmed = line.replace(/^(\d+\.\s+|•\s+|☐\s+|\[\s*\]\s*)/, '');
      return `• ${trimmed}`;
    })
    .join('\n');
}

export function toChecklist(text: string): string {
  const lines = text.split('\n');
  return lines
    .map(line => {
      const trimmed = line.replace(/^(\d+\.\s+|•\s+|☐\s+|\[\s*\]\s*)/, '');
      return `☐ ${trimmed}`;
    })
    .join('\n');
}

export function toAscendingList(text: string): string {
  const lines = text.split('\n');
  return [...lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('\n');
}

export function toDescendingList(text: string): string {
  const lines = text.split('\n');
  return [...lines].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).join('\n');
}

export function unformatText(text: string): string {
  const chars = parseString(text);
  return chars.map(c => c.base).join('');
}
