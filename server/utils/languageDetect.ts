/**
 * Language detector supporting Indic scripts (Hindi, Gujarati, Marathi, Bengali, Tamil, etc.)
 * as well as Latin and world languages.
 */

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
}

export const LANGUAGE_MAP: Record<string, LanguageInfo> = {
  hi: { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  gu: { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  en: { code: 'en', name: 'English', nativeName: 'English' },
  mr: { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  bn: { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  ta: { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  te: { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español' },
  fr: { code: 'fr', name: 'French', nativeName: 'Français' },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch' },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  zh: { code: 'zh', name: 'Chinese', nativeName: '中文' },
  ar: { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  ru: { code: 'ru', name: 'Russian', nativeName: 'Русский' },
};

export function detectLanguage(text: string): { code: string; name: string } {
  if (!text || text.trim().length === 0) {
    return { code: 'en', name: 'English' };
  }

  let gujaratiCount = 0;
  let devanagariCount = 0;
  let bengaliCount = 0;
  let tamilCount = 0;
  let teluguCount = 0;
  let arabicCount = 0;
  let cjkCount = 0;
  let cyrillicCount = 0;
  let latinCount = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Gujarati: U+0A80 to U+0AFF
    if (code >= 0x0a80 && code <= 0x0aff) {
      gujaratiCount++;
    }
    // Devanagari (Hindi, Marathi, Sanskrit, Nepali): U+0900 to U+097F
    else if (code >= 0x0900 && code <= 0x097f) {
      devanagariCount++;
    }
    // Bengali: U+0980 to U+09FF
    else if (code >= 0x0980 && code <= 0x09ff) {
      bengaliCount++;
    }
    // Tamil: U+0B80 to U+0BFF
    else if (code >= 0x0b80 && code <= 0x0bff) {
      tamilCount++;
    }
    // Telugu: U+0C00 to U+0C7F
    else if (code >= 0x0c00 && code <= 0x0c7f) {
      teluguCount++;
    }
    // Arabic: U+0600 to U+06FF
    else if (code >= 0x0600 && code <= 0x06ff) {
      arabicCount++;
    }
    // CJK (Chinese, Japanese): U+4E00 to U+9FFF
    else if (code >= 0x4e00 && code <= 0x9fff) {
      cjkCount++;
    }
    // Cyrillic: U+0400 to U+04FF
    else if (code >= 0x0400 && code <= 0x04ff) {
      cyrillicCount++;
    }
    // Latin: A-Z, a-z
    else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      latinCount++;
    }
  }

  // Find max script
  if (gujaratiCount > 15 && gujaratiCount >= devanagariCount && gujaratiCount >= latinCount) {
    return { code: 'gu', name: 'Gujarati' };
  }

  if (devanagariCount > 15 && devanagariCount >= latinCount) {
    // Check Marathi specific words/characters (ळ, etc.) vs Hindi
    if (text.includes('आहे') || text.includes('झाला') || text.includes('होता') || text.includes('मराठी')) {
      return { code: 'mr', name: 'Marathi' };
    }
    return { code: 'hi', name: 'Hindi' };
  }

  if (bengaliCount > 15) return { code: 'bn', name: 'Bengali' };
  if (tamilCount > 15) return { code: 'ta', name: 'Tamil' };
  if (teluguCount > 15) return { code: 'te', name: 'Telugu' };
  if (arabicCount > 15) return { code: 'ar', name: 'Arabic' };
  if (cjkCount > 15) return { code: 'zh', name: 'Chinese' };
  if (cyrillicCount > 15) return { code: 'ru', name: 'Russian' };

  // Common Latin language heuristics
  const lower = text.toLowerCase();
  if (lower.includes(' el ') || lower.includes(' la ') || lower.includes(' en ') || lower.includes(' que ') || lower.includes(' los ')) {
    if (lower.includes(' y ') || lower.includes(' por ') || lower.includes(' con ')) {
      return { code: 'es', name: 'Spanish' };
    }
  }
  if (lower.includes(' le ') || lower.includes(' la ') || lower.includes(' les ') || lower.includes(' et ') || lower.includes(' dans ') || lower.includes(' une ')) {
    return { code: 'fr', name: 'French' };
  }
  if (lower.includes(' der ') || lower.includes(' die ') || lower.includes(' das ') || lower.includes(' und ') || lower.includes(' nicht ')) {
    return { code: 'de', name: 'German' };
  }

  return { code: 'en', name: 'English' };
}
