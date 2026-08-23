from typing import List, Dict, Any
from backend.llm.client import call_structured
from backend.models.schemas import FidelityIssue, Project

def run_stage11_fidelity(project: Project) -> Project:
    sot = project.source_of_truth
    if not sot:
        raise ValueError("Source of Truth missing before Stage 11")

    fidelity_issues: List[FidelityIssue] = []

    event_scene_count: Dict[str, int] = {}
    for scene in project.scenes:
        event_scene_count[scene.event_id] = event_scene_count.get(scene.event_id, 0) + 1

    for evt in sot.events:
        count = event_scene_count.get(evt.id, 0)
        if count == 0:
            fidelity_issues.append(
                FidelityIssue(
                    event_id=evt.id,
                    issue_type="altered_event",
                    description=f"Source of Truth event '{evt.id}' ({evt.description[:40]}...) is missing from generated scenes.",
                    severity="high",
                )
            )
        elif count > 1:
            fidelity_issues.append(
                FidelityIssue(
                    event_id=evt.id,
                    issue_type="altered_event",
                    description=f"Source of Truth event '{evt.id}' is duplicated across {count} scenes.",
                    severity="medium",
                )
            )

    scenes_summary = "\n\n".join(
        [
            f"[SCENE {idx + 1}] ID: {s.id} | EventID: {s.event_id}\n"
            f"Title: {s.scene_title}\n"
            f"Action: {s.what_happens}\n"
            f"Narration: {s.narration}\n"
            f"Dialogue: {' | '.join([d.speaker + ': ' + d.text for d in s.dialogue]) or 'None'}\n"
            f"Image Prompt: {s.image_prompt}"
            for idx, s in enumerate(project.scenes)
        ]
    )

    ground_truth_summary = "\n".join(
        [f"[EVENT {e.id}] ({e.emotion}, Loc: {e.location_id}): {e.description}" for e in sot.events]
    )

    facts_summary = "\n".join([f"- {f}" for f in sot.facts])

    prompt = f"""You are a strict Screenplay Fidelity Judge.
Compare the generated scenes against the locked Ground Truth Source of Truth.
Identify any hallucinations, altered plot outcomes, invented facts, or character relationship contradictions.

LOCKED GROUND TRUTH EVENTS:
{ground_truth_summary}

LOCKED ATOMIC FACTS:
{facts_summary}

GENERATED SCENES:
{scenes_summary}

Check each scene for:
- "hallucination": scene claims events or magic/technology not in story
- "wrong_relationship": characters behave in direct contradiction to source
- "altered_event": outcome or key death/victory is reversed or modified
- "missing_character": key protagonist omitted from their canonical scene
- "unsupported_fact": specific factual assertion fabricated without basis

Return JSON:
{{
  "has_issues": true,
  "issues": [
    {{
      "scene_id": "scene_01",
      "event_id": "event_01",
      "issue_type": "hallucination",
      "description": "Clear explanation of the divergence",
      "severity": "low"
    }}
  ]
}}"""

    res = call_structured(
        prompt=prompt,
        stage=11,
        stage_name="Fidelity & Hallucination Judge",
        project_id=project.status.project_id,
        is_light_task=False,
    )

    if isinstance(res, dict) and isinstance(res.get("issues"), list):
        for issue in res["issues"]:
            if isinstance(issue, dict):
                fidelity_issues.append(
                    FidelityIssue(
                        scene_id=issue.get("scene_id") or (project.scenes[0].id if project.scenes else "scene_01"),
                        event_id=issue.get("event_id") or (sot.events[0].id if sot.events else "event_01"),
                        issue_type=issue.get("issue_type") or "unsupported_fact",
                        description=issue.get("description") or "Fidelity variance observed.",
                        severity=issue.get("severity") or "low",
                    )
                )

    project.fidelity_issues = fidelity_issues
    project.stage_outputs["stage_11"] = {
        "total_fidelity_issues": len(fidelity_issues),
        "fidelity_score_percent": max(0, 100 - len(fidelity_issues) * 5),
        "verdict": "PASSED_PERFECT_FIDELITY" if len(fidelity_issues) == 0 else "PASSED_WITH_NOTICES",
    }

    return project
