import re
from typing import List

def split_into_sections(raw_text: str, max_words_per_section: int = 400) -> List[str]:
    """
    Splits raw story text into coherent sections based on paragraphs and word limits.
    """
    cleaned = raw_text.strip().replace("\r\n", "\n")
    if not cleaned:
        return []

    # Split by double newline (paragraphs) first
    raw_paragraphs = [p.strip() for p in re.split(r"\n\s*\n", cleaned) if p.strip()]

    if not raw_paragraphs:
        return [cleaned]

    sections: List[str] = []
    current_section_words: List[str] = []

    for para in raw_paragraphs:
        para_words = [w for w in re.split(r"\s+", para) if w]

        # If adding this paragraph exceeds target word count and we already have content, flush
        if current_section_words and (len(current_section_words) + len(para_words) > max_words_per_section):
            sections.append(" ".join(current_section_words))
            current_section_words = list(para_words)
        else:
            current_section_words.extend(para_words)

    if current_section_words:
        sections.append(" ".join(current_section_words))

    # If story was one giant block without paragraph breaks, split by sentences
    if len(sections) == 1 and len(current_section_words) > max_words_per_section * 1.5:
        sentence_pattern = r"[^.!?।]+[.!?।]+|\S+"
        sentences = re.findall(sentence_pattern, cleaned) or [cleaned]
        sentence_sections: List[str] = []
        current_words: List[str] = []

        for sent in sentences:
            words = [w for w in re.split(r"\s+", sent.strip()) if w]
            if current_words and (len(current_words) + len(words) > max_words_per_section):
                sentence_sections.append(" ".join(current_words))
                current_words = list(words)
            else:
                current_words.extend(words)

        if current_words:
            sentence_sections.append(" ".join(current_words))

        return sentence_sections if sentence_sections else sections

    return sections if sections else [cleaned]
