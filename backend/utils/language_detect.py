from typing import Dict, Any

LANGUAGE_MAP: Dict[str, Dict[str, str]] = {
    "hi": {"code": "hi", "name": "Hindi", "nativeName": "हिन्दी"},
    "gu": {"code": "gu", "name": "Gujarati", "nativeName": "ગુજરાતી"},
    "en": {"code": "en", "name": "English", "nativeName": "English"},
    "mr": {"code": "mr", "name": "Marathi", "nativeName": "मराठी"},
    "bn": {"code": "bn", "name": "Bengali", "nativeName": "বাংলা"},
    "ta": {"code": "ta", "name": "Tamil", "nativeName": "தமிழ்"},
    "te": {"code": "te", "name": "Telugu", "nativeName": "తెలుగు"},
    "es": {"code": "es", "name": "Spanish", "nativeName": "Español"},
    "fr": {"code": "fr", "name": "French", "nativeName": "Français"},
    "de": {"code": "de", "name": "German", "nativeName": "Deutsch"},
    "ja": {"code": "ja", "name": "Japanese", "nativeName": "日本語"},
    "zh": {"code": "zh", "name": "Chinese", "nativeName": "中文"},
    "ar": {"code": "ar", "name": "Arabic", "nativeName": "العربية"},
    "ru": {"code": "ru", "name": "Russian", "nativeName": "Русский"},
}

def detect_language(text: str) -> Dict[str, str]:
    if not text or not text.strip():
        return {"code": "en", "name": "English"}

    gujarati_count = 0
    devanagari_count = 0
    bengali_count = 0
    tamil_count = 0
    telugu_count = 0
    arabic_count = 0
    cjk_count = 0
    cyrillic_count = 0
    latin_count = 0

    for char in text:
        code = ord(char)
        # Gujarati: U+0A80 to U+0AFF
        if 0x0A80 <= code <= 0x0AFF:
            gujarati_count += 1
        # Devanagari (Hindi, Marathi, Sanskrit): U+0900 to U+097F
        elif 0x0900 <= code <= 0x097F:
            devanagari_count += 1
        # Bengali: U+0980 to U+09FF
        elif 0x0980 <= code <= 0x09FF:
            bengali_count += 1
        # Tamil: U+0B80 to U+0BFF
        elif 0x0B80 <= code <= 0x0BFF:
            tamil_count += 1
        # Telugu: U+0C00 to U+0C7F
        elif 0x0C00 <= code <= 0x0C7F:
            telugu_count += 1
        # Arabic: U+0600 to U+06FF
        elif 0x0600 <= code <= 0x06FF:
            arabic_count += 1
        # CJK (Chinese, Japanese): U+4E00 to U+9FFF
        elif 0x4E00 <= code <= 0x9FFF:
            cjk_count += 1
        # Cyrillic: U+0400 to U+04FF
        elif 0x0400 <= code <= 0x04FF:
            cyrillic_count += 1
        # Latin
        elif (65 <= code <= 90) or (97 <= code <= 122):
            latin_count += 1

    if gujarati_count > 15 and gujarati_count >= devanagari_count and gujarati_count >= latin_count:
        return {"code": "gu", "name": "Gujarati"}

    if devanagari_count > 15 and devanagari_count >= latin_count:
        if any(w in text for w in ["आहे", "झाला", "होता", "मराठी"]):
            return {"code": "mr", "name": "Marathi"}
        return {"code": "hi", "name": "Hindi"}

    if bengali_count > 15:
        return {"code": "bn", "name": "Bengali"}
    if tamil_count > 15:
        return {"code": "ta", "name": "Tamil"}
    if telugu_count > 15:
        return {"code": "te", "name": "Telugu"}
    if arabic_count > 15:
        return {"code": "ar", "name": "Arabic"}
    if cjk_count > 15:
        return {"code": "zh", "name": "Chinese"}
    if cyrillic_count > 15:
        return {"code": "ru", "name": "Russian"}

    lower = text.lower()
    if any(w in lower for w in [" el ", " la ", " en ", " que ", " los "]) and any(w in lower for w in [" y ", " por ", " con "]):
        return {"code": "es", "name": "Spanish"}
    if any(w in lower for w in [" le ", " la ", " les ", " et ", " dans ", " une "]):
        return {"code": "fr", "name": "French"}
    if any(w in lower for w in [" der ", " die ", " das ", " und ", " nicht "]):
        return {"code": "de", "name": "German"}

    return {"code": "en", "name": "English"}
