/**
 * Splits raw story into coherent sections (paragraphs/scenes)
 */

export function splitIntoSections(rawText: string, maxWordsPerSection: number = 400): string[] {
  const cleaned = rawText.trim().replace(/\r\n/g, '\n');
  if (!cleaned) return [];

  // Split by double newline (paragraphs) first
  const rawParagraphs = cleaned.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  if (rawParagraphs.length === 0) {
    return [cleaned];
  }

  const sections: string[] = [];
  let currentSectionWords: string[] = [];

  for (const para of rawParagraphs) {
    const paraWords = para.split(/\s+/).filter(Boolean);

    // If adding this paragraph exceeds target word count and we already have content, flush
    if (currentSectionWords.length > 0 && currentSectionWords.length + paraWords.length > maxWordsPerSection) {
      sections.push(currentSectionWords.join(' '));
      currentSectionWords = [...paraWords];
    } else {
      currentSectionWords.push(...paraWords);
    }
  }

  if (currentSectionWords.length > 0) {
    sections.push(currentSectionWords.join(' '));
  }

  // If story was one giant block without paragraph breaks, split by sentences
  if (sections.length === 1 && currentSectionWords.length > maxWordsPerSection * 1.5) {
    const sentences = cleaned.match(/[^.!?।]+[.!?।]+|\S+/g) || [cleaned];
    const sentenceSections: string[] = [];
    let currentWords: string[] = [];

    for (const sent of sentences) {
      const words = sent.trim().split(/\s+/).filter(Boolean);
      if (currentWords.length > 0 && currentWords.length + words.length > maxWordsPerSection) {
        sentenceSections.push(currentWords.join(' '));
        currentWords = [...words];
      } else {
        currentWords.push(...words);
      }
    }
    if (currentWords.length > 0) {
      sentenceSections.push(currentWords.join(' '));
    }
    return sentenceSections.length > 0 ? sentenceSections : sections;
  }

  return sections.length > 0 ? sections : [cleaned];
}
