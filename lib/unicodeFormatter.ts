/**
 * LinkedIn Unicode Text Formatter & Font Converter Utility
 * Maps standard ASCII characters to Unicode mathematical fonts and combining marks.
 */

// Helper to construct offset maps safely for surrogate pairs
function mapChar(code: number, baseChar: string, targetOffset: number): string {
  return String.fromCodePoint(targetOffset + (code - baseChar.charCodeAt(0)));
}

// 1. Bold (Serif)
export function toBoldSerif(text: string): string {
  let result = '';
  for (const char of text) {
    const cp = char.codePointAt(0) || 0;
    if (cp >= 0x41 && cp <= 0x5a) {
      result += String.fromCodePoint(0x1d400 + (cp - 0x41)); // A-Z
    } else if (cp >= 0x61 && cp <= 0x7a) {
      result += String.fromCodePoint(0x1d41a + (cp - 0x61)); // a-z
    } else if (cp >= 0x30 && cp <= 0x39) {
      result += String.fromCodePoint(0x1d7ce + (cp - 0x30)); // 0-9
    } else {
      result += char;
    }
  }
  return result;
}

// 2. Bold Sans
export function toBoldSans(text: string): string {
  let result = '';
  for (const char of text) {
    const cp = char.codePointAt(0) || 0;
    if (cp >= 0x41 && cp <= 0x5a) {
      result += String.fromCodePoint(0x1d5d4 + (cp - 0x41)); // A-Z Bold Sans
    } else if (cp >= 0x61 && cp <= 0x7a) {
      result += String.fromCodePoint(0x1d5ee + (cp - 0x61)); // a-z Bold Sans
    } else if (cp >= 0x30 && cp <= 0x39) {
      result += String.fromCodePoint(0x1d7ec + (cp - 0x30)); // 0-9 Bold Sans
    } else {
      result += char;
    }
  }
  return result;
}

// 3. Italic (Serif)
export function toItalicSerif(text: string): string {
  let result = '';
  for (const char of text) {
    const cp = char.codePointAt(0) || 0;
    if (char === 'h') {
      result += 'ℎ'; // U+210E Planck constant exception
    } else if (cp >= 0x41 && cp <= 0x5a) {
      result += String.fromCodePoint(0x1d434 + (cp - 0x41)); // A-Z
    } else if (cp >= 0x61 && cp <= 0x7a) {
      result += String.fromCodePoint(0x1d44e + (cp - 0x61)); // a-z
    } else {
      result += char; // numbers have no italic variant
    }
  }
  return result;
}

// 4. Italic Sans
export function toItalicSans(text: string): string {
  let result = '';
  for (const char of text) {
    const cp = char.codePointAt(0) || 0;
    if (cp >= 0x41 && cp <= 0x5a) {
      result += String.fromCodePoint(0x1d608 + (cp - 0x41)); // A-Z
    } else if (cp >= 0x61 && cp <= 0x7a) {
      result += String.fromCodePoint(0x1d622 + (cp - 0x61)); // a-z
    } else {
      result += char;
    }
  }
  return result;
}

// 5. Bold Italic (Serif)
export function toBoldItalicSerif(text: string): string {
  let result = '';
  for (const char of text) {
    const cp = char.codePointAt(0) || 0;
    if (cp >= 0x41 && cp <= 0x5a) {
      result += String.fromCodePoint(0x1d468 + (cp - 0x41)); // A-Z
    } else if (cp >= 0x61 && cp <= 0x7a) {
      result += String.fromCodePoint(0x1d482 + (cp - 0x61)); // a-z
    } else {
      result += char;
    }
  }
  return result;
}

// 6. Bold Italic Sans
export function toBoldItalicSans(text: string): string {
  let result = '';
  for (const char of text) {
    const cp = char.codePointAt(0) || 0;
    if (cp >= 0x41 && cp <= 0x5a) {
      result += String.fromCodePoint(0x1d63c + (cp - 0x41)); // A-Z
    } else if (cp >= 0x61 && cp <= 0x7a) {
      result += String.fromCodePoint(0x1d656 + (cp - 0x61)); // a-z
    } else {
      result += char;
    }
  }
  return result;
}

// 7. Sans (Regular)
export function toSans(text: string): string {
  let result = '';
  for (const char of text) {
    const cp = char.codePointAt(0) || 0;
    if (cp >= 0x41 && cp <= 0x5a) {
      result += String.fromCodePoint(0x1d5a0 + (cp - 0x41)); // A-Z Sans Regular
    } else if (cp >= 0x61 && cp <= 0x7a) {
      result += String.fromCodePoint(0x1d5ba + (cp - 0x61)); // a-z Sans Regular
    } else if (cp >= 0x30 && cp <= 0x39) {
      result += String.fromCodePoint(0x1d7e2 + (cp - 0x30)); // 0-9 Sans Regular
    } else {
      result += char;
    }
  }
  return result;
}

// 8. Underline
export function toUnderline(text: string): string {
  let result = '';
  for (const char of text) {
    if (char === '\n') {
      result += '\n';
    } else {
      result += char + '\u0332';
    }
  }
  return result;
}

// 9. Strikethrough (Combining Short Stroke Overlay for central horizontal line)
export function toStrikethrough(text: string): string {
  let result = '';
  for (const char of text) {
    if (char === '\n') {
      result += '\n';
    } else {
      result += char + '\u0335';
    }
  }
  return result;
}

// 10. Bold Underline
export function toBoldUnderline(text: string): string {
  const bold = toBoldSans(text);
  return toUnderline(bold);
}

// 11. Bold Strikethrough
export function toBoldStrikethrough(text: string): string {
  const bold = toBoldSans(text);
  return toStrikethrough(bold);
}

// 12. Script
const scriptExceptions: Record<string, string> = {
  'B': 'ℬ', // U+212C
  'E': 'ℰ', // U+2130
  'F': 'ℱ', // U+2131
  'H': 'ℋ', // U+210B
  'I': 'ℐ', // U+2110
  'L': 'ℒ', // U+2112
  'M': 'ℳ', // U+2133
  'R': 'ℛ', // U+211B
  'e': 'ℯ', // U+2147
  'g': 'ℊ', // U+210A
  'o': 'ℴ', // U+2148
};

export function toScript(text: string): string {
  let result = '';
  for (const char of text) {
    if (scriptExceptions[char]) {
      result += scriptExceptions[char];
    } else {
      const cp = char.codePointAt(0) || 0;
      if (cp >= 0x41 && cp <= 0x5a) {
        result += String.fromCodePoint(0x1d49c + (cp - 0x41)); // A-Z
      } else if (cp >= 0x61 && cp <= 0x7a) {
        result += String.fromCodePoint(0x1d4b6 + (cp - 0x61)); // a-z
      } else {
        result += char;
      }
    }
  }
  return result;
}

// 13. Doublestruck
const doubleStruckExceptions: Record<string, string> = {
  'C': 'ℂ', // U+2102
  'H': 'ℍ', // U+210D
  'N': 'ℕ', // U+2115
  'P': 'ℙ', // U+2119
  'Q': 'ℚ', // U+211A
  'R': 'ℝ', // U+211D
  'Z': 'ℤ', // U+2124
};

export function toDoubleStruck(text: string): string {
  let result = '';
  for (const char of text) {
    if (doubleStruckExceptions[char]) {
      result += doubleStruckExceptions[char];
    } else {
      const cp = char.codePointAt(0) || 0;
      if (cp >= 0x41 && cp <= 0x5a) {
        result += String.fromCodePoint(0x1d538 + (cp - 0x41)); // A-Z
      } else if (cp >= 0x61 && cp <= 0x7a) {
        result += String.fromCodePoint(0x1d552 + (cp - 0x61)); // a-z
      } else if (cp >= 0x30 && cp <= 0x39) {
        result += String.fromCodePoint(0x1d7d8 + (cp - 0x30)); // 0-9
      } else {
        result += char;
      }
    }
  }
  return result;
}

// 14. Fullwidth
export function toFullwidth(text: string): string {
  let result = '';
  for (const char of text) {
    if (char === ' ') {
      result += '　'; // U+3000 Fullwidth space
    } else {
      const cp = char.codePointAt(0) || 0;
      if (cp >= 0x21 && cp <= 0x7e) {
        result += String.fromCodePoint(0xff01 + (cp - 0x21));
      } else {
        result += char;
      }
    }
  }
  return result;
}

// 15. Uppercase
export function toUppercase(text: string): string {
  return text.toUpperCase();
}

// 16. Lowercase
export function toLowercase(text: string): string {
  return text.toLowerCase();
}

// 17. Numbered List
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

// 18. Bullet Points
export function toBulletList(text: string): string {
  const lines = text.split('\n');
  return lines
    .map(line => {
      const trimmed = line.replace(/^(\d+\.\s+|•\s+|☐\s+|\[\s*\]\s*)/, '');
      return `• ${trimmed}`;
    })
    .join('\n');
}

// 19. Checklist
export function toChecklist(text: string): string {
  const lines = text.split('\n');
  return lines
    .map(line => {
      const trimmed = line.replace(/^(\d+\.\s+|•\s+|☐\s+|\[\s*\]\s*)/, '');
      return `☐ ${trimmed}`;
    })
    .join('\n');
}

// 20. Ascending List
export function toAscendingList(text: string): string {
  const lines = text.split('\n');
  return [...lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('\n');
}

// 21. Descending List
export function toDescendingList(text: string): string {
  const lines = text.split('\n');
  return [...lines].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).join('\n');
}

// Reverse-Mapping Engine (Unformat)
export function unformatText(text: string): string {
  let clean = text.replace(/[\u0332\u0336]/g, ''); // strip combining marks
  let result = '';
  
  // Revert fullwidth space
  clean = clean.replace(/　/g, ' ');

  for (let i = 0; i < clean.length; i++) {
    const cp = clean.codePointAt(i) || 0;
    const char = String.fromCodePoint(cp);

    // If surrogate pair, skip second code unit in loop counter
    if (cp > 0xffff) {
      i++;
    }

    // Letterlike Symbol Exceptions
    if (char === 'ℎ') { result += 'h'; continue; }
    if (char === 'ℬ') { result += 'B'; continue; }
    if (char === 'ℰ') { result += 'E'; continue; }
    if (char === 'ℱ') { result += 'F'; continue; }
    if (char === 'ℋ') { result += 'H'; continue; }
    if (char === 'ℐ') { result += 'I'; continue; }
    if (char === 'ℒ') { result += 'L'; continue; }
    if (char === 'ℳ') { result += 'M'; continue; }
    if (char === 'ℛ') { result += 'R'; continue; }
    if (char === 'ℯ') { result += 'e'; continue; }
    if (char === 'ℊ') { result += 'g'; continue; }
    if (char === 'ℴ') { result += 'o'; continue; }

    if (char === 'ℂ') { result += 'C'; continue; }
    if (char === 'ℍ') { result += 'H'; continue; }
    if (char === 'ℕ') { result += 'N'; continue; }
    if (char === 'ℙ') { result += 'P'; continue; }
    if (char === 'ℚ') { result += 'Q'; continue; }
    if (char === 'ℝ') { result += 'R'; continue; }
    if (char === 'ℤ') { result += 'Z'; continue; }

    // Bold Serif
    if (cp >= 0x1d400 && cp <= 0x1d419) { result += String.fromCharCode(0x41 + (cp - 0x1d400)); continue; }
    if (cp >= 0x1d41a && cp <= 0x1d433) { result += String.fromCharCode(0x61 + (cp - 0x1d41a)); continue; }
    if (cp >= 0x1d7ce && cp <= 0x1d7d7) { result += String.fromCharCode(0x30 + (cp - 0x1d7ce)); continue; }

    // Sans Regular
    if (cp >= 0x1d5a0 && cp <= 0x1d5b9) { result += String.fromCharCode(0x41 + (cp - 0x1d5a0)); continue; }
    if (cp >= 0x1d5ba && cp <= 0x1d5d3) { result += String.fromCharCode(0x61 + (cp - 0x1d5ba)); continue; }
    if (cp >= 0x1d7e2 && cp <= 0x1d7eb) { result += String.fromCharCode(0x30 + (cp - 0x1d7e2)); continue; }

    // Italic Serif
    if (cp >= 0x1d434 && cp <= 0x1d44d) { result += String.fromCharCode(0x41 + (cp - 0x1d434)); continue; }
    if (cp >= 0x1d44e && cp <= 0x1d467) { result += String.fromCharCode(0x61 + (cp - 0x1d44e)); continue; }

    // Italic Sans
    if (cp >= 0x1d608 && cp <= 0x1d621) { result += String.fromCharCode(0x41 + (cp - 0x1d608)); continue; }
    if (cp >= 0x1d622 && cp <= 0x1d63b) { result += String.fromCharCode(0x61 + (cp - 0x1d622)); continue; }

    // Bold Italic Serif
    if (cp >= 0x1d468 && cp <= 0x1d481) { result += String.fromCharCode(0x41 + (cp - 0x1d468)); continue; }
    if (cp >= 0x1d482 && cp <= 0x1d49b) { result += String.fromCharCode(0x61 + (cp - 0x1d482)); continue; }

    // Bold Italic Sans
    if (cp >= 0x1d63c && cp <= 0x1d655) { result += String.fromCharCode(0x41 + (cp - 0x1d63c)); continue; }
    if (cp >= 0x1d656 && cp <= 0x1d66f) { result += String.fromCharCode(0x61 + (cp - 0x1d656)); continue; }

    // Bold Sans
    if (cp >= 0x1d5d4 && cp <= 0x1d5ed) { result += String.fromCharCode(0x41 + (cp - 0x1d5d4)); continue; }
    if (cp >= 0x1d5ee && cp <= 0x1d607) { result += String.fromCharCode(0x61 + (cp - 0x1d5ee)); continue; }
    if (cp >= 0x1d7ec && cp <= 0x1d7f5) { result += String.fromCharCode(0x30 + (cp - 0x1d7ec)); continue; }

    // Script
    if (cp >= 0x1d49c && cp <= 0x1d4b5) { result += String.fromCharCode(0x41 + (cp - 0x1d49c)); continue; }
    if (cp >= 0x1d4b6 && cp <= 0x1d4cf) { result += String.fromCharCode(0x61 + (cp - 0x1d4b6)); continue; }

    // Double Struck
    if (cp >= 0x1d538 && cp <= 0x1d551) { result += String.fromCharCode(0x41 + (cp - 0x1d538)); continue; }
    if (cp >= 0x1d552 && cp <= 0x1d56b) { result += String.fromCharCode(0x61 + (cp - 0x1d552)); continue; }
    if (cp >= 0x1d7d8 && cp <= 0x1d7e1) { result += String.fromCharCode(0x30 + (cp - 0x1d7d8)); continue; }

    // Fullwidth
    if (cp >= 0xff01 && cp <= 0xff5e) { result += String.fromCharCode(0x21 + (cp - 0xff01)); continue; }

    result += char;
  }
  return result;
}
