import hashlib
import json
from typing import Dict, Any, List

def compute_source_of_truth_checksum(data: Dict[str, Any]) -> str:
    """
    Computes a deterministic SHA-256 hash across canonicalized Source of Truth data.
    """
    chars = sorted(data.get("characters", []), key=lambda x: (x.get("id") if isinstance(x, dict) else x.id))
    locs = sorted(data.get("locations", []), key=lambda x: (x.get("id") if isinstance(x, dict) else x.id))
    evts = sorted(data.get("events", []), key=lambda x: (x.get("order_index") if isinstance(x, dict) else x.order_index))
    
    def get_dlg_key(d):
        if isinstance(d, dict):
            return f"{d.get('event_id')}_{d.get('speaker')}"
        return f"{d.event_id}_{d.speaker}"
        
    dlgs = sorted(data.get("dialogue_lines", []), key=get_dlg_key)
    facts = sorted(data.get("facts", []))
    
    # Helper to convert models to dicts if needed
    def to_dict_item(item):
        if hasattr(item, "model_dump"):
            return item.model_dump()
        if hasattr(item, "dict"):
            return item.dict()
        return item

    canonical_data = {
        "detected_language": data.get("detected_language", "en"),
        "characters": [to_dict_item(c) for c in chars],
        "locations": [to_dict_item(l) for l in locs],
        "events": [to_dict_item(e) for e in evts],
        "dialogue_lines": [to_dict_item(d) for d in dlgs],
        "facts": facts,
    }
    
    json_str = json.dumps(canonical_data, sort_keys=True)
    return hashlib.sha256(json_str.encode("utf-8")).hexdigest()

def verify_source_of_truth_checksum(checksum: str, data: Dict[str, Any]) -> bool:
    recomputed = compute_source_of_truth_checksum(data)
    return recomputed == checksum
