import asyncio
import csv
import io
import json
import time
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse, PlainTextResponse

from backend.config import settings
from backend.models.schemas import (
    CreateProjectRequest,
    Project,
    ProjectStatus,
    ResumeProjectRequest,
    SubmitClarificationRequest,
)
from backend.pipeline.orchestrator import pipeline_orchestrator
from backend.storage.project_store import project_store

router = APIRouter()

SAMPLE_STORIES = [
    {
        "id": "sample_ramayana",
        "title": "The Quest for the Golden Deer (Ramayana Episode)",
        "language": "en",
        "story": """In the lush, ancient forest of Panchavati, Lord Rama, his virtuous wife Sita, and his devoted brother Lakshmana lived in peaceful exile. The morning sun filtered through the canopy, casting golden patterns upon the green grass.

Suddenly, Sita caught sight of an extraordinary deer grazing near the clearing. Its coat shimmered like spun gold, sprinkled with silver spots, and its hooves were made of solid sapphire. Enamored by its divine beauty, Sita turned to Rama with pleading eyes. "Dearest Rama," she whispered, "look at that enchanting creature. I long for its soft pelt, or to keep it as a companion in our hermitage."

Lakshmana, ever vigilant, frowned and warned Rama, "Brother, this cannot be a real deer. In these dark woods, demons assume alluring forms to deceive us. It is surely Maricha in disguise."

Rama smiled gently at Lakshmana and replied, "Even if it is a demon in disguise, Lakshmana, it must be slain to protect the sages of this forest. Guard Sita with your life; do not leave her side under any circumstance."

With bow in hand, Rama pursued the elusive deer deep into the dense woods. The deer leaped across boulders and disappeared into misty ravines, leading Rama further away from the cottage. Realizing the creature was uncatchable, Rama shot a golden arrow. As the arrow struck, the deer transformed into the towering demon Maricha. With his dying breath, Maricha mimicked Rama's voice and cried out in agony across the valley: "Ah Sita! Ah Lakshmana! Save me!"

Back at the hermitage, Sita heard the agonizing cry and trembled with dread. "Lakshmana! Your brother is in mortal danger! Go to him at once!" Lakshmana tried to calm her, insisting Rama was invincible, but Sita's fear drove her to harsh words. Bound by duty and sorrow, Lakshmana drew a mystic line of protection—the Lakshmana Rekha—around the cottage with the tip of his arrow. "Mother Sita, do not cross this line," he begged before rushing into the forest.

Moments later, a humble sage in saffron robes carrying an alms bowl appeared outside the boundary, asking for food. When Sita brought fruit, the sage stood just beyond the line, refusing to step closer. Compelled by sacred hospitality, Sita stepped across the Lakshmana Rekha. Instantly, the sage shed his disguise, revealing the ten-headed demon king Ravana, who seized Sita and mounted his flying chariot toward Lanka.""",
    },
    {
        "id": "sample_gujarati",
        "title": "વીર ભાણજી અને સોરઠનો કિલ્લો (Folk Tale)",
        "language": "gu",
        "story": """સોરઠની ધરતી પર સંધ્યાનો લાલ રંગ ઢળી રહ્યો હતો. ગિરનારના ગગનચુંબી શિખરો પર પવન સૂસવાટા મારતો હતો. કિલ્લાના મુખ્ય દરવાજે વીર ભાણજી પોતાની તલવારની ધાર તપાસી રહ્યો હતો. તેનો વફાદાર ઘોડો 'તોફાન' જમીન પર ખરીઓ પછાડીને યુદ્ધનો સંકેત આપી રહ્યો હતો.

સેનાપતિ દેવરાજે આવીને સમાચાર આપ્યા, "ભાણજી ભાઈ, દુશ્મન લશ્કર નદી પાર કરી ચૂક્યું છે. તેમની પાસે ત્રણ હજાર સૈનિકો છે અને આપણી પાસે માત્ર ત્રણસો!"

ભાણજીએ મૂછ પર તાવ દેતા હસીને કહ્યું, "દેવરાજ, સોરઠની ધરતી પર સૈનિકોની સંખ્યા નહીં, તેમના કાળજાની મરદાનગી લડતી હોય છે. ગિરનારના પથ્થરો પણ આપણી ઢાલ બનશે."

રાત્રિના અંધકારમાં યુદ્ધ શરૂ થયું. તલવારોના ખણખણાટ અને મશાલોના અજવાળાથી આકાશ ગૂંજી ઊઠ્યું. ભાણજીએ વીજળીની ઝડપે દુશ્મન દળમાં ઘૂસીને કિલ્લાની રક્ષા કરી. આખરે દુશ્મનોએ પીછેહઠ કરવી પડી અને સોરઠનો વિજયધ્વજ ગિરનારની ટોચ પર લહેરાયો.""",
    },
    {
        "id": "sample_hindi",
        "title": "विक्रम और बेताल: न्याय का रहस्य (Classic Tale)",
        "language": "hi",
        "story": """अमावस्या की घोर अंधेरी रात थी। बीहड़ श्मशान में चारों ओर सन्नाटा पसरा हुआ था। प्रतापी राजा विक्रम ने पेड़ से लटके हुए शव को नीचे उतारा और उसे अपने कंधे पर लादकर मौन व्रत धारण करते हुए आगे बढ़ने लगे।

शव में वास कर रहे बेताल ने कहा, "हे राजन! तुम्हारा यह अथक प्रयास प्रशंसनीय है, किंतु मार्ग लंबा है। तुम्हारा मन बहलाने के लिए मैं तुम्हें एक कहानी सुनाता हूँ। परंतु स्मरण रहे, यदि तुमने बोलने का प्रयास किया, तो मैं उड़कर पुनः पेड़ पर जा लटकूँगा।"

बेताल ने काशी के न्यायप्रिय व्यापारी और उसके तीन निष्ठावान मित्रों की एक जटिल धर्मसंकट भरी कथा सुनाई। कहानी समाप्त होने पर बेताल ने पूछा, "बताओ राजन, उन तीनों में से सबसे बड़ा त्यागी कौन था? यदि जानते हुए भी तुमने उत्तर नहीं दिया, तो तुम्हारे सिर के सौ टुकड़े हो जाएंगे।"

राजा विक्रम ने अपने गहन विवेक से धर्मसंगत न्याय करते हुए सटीक उत्तर दिया। जैसे ही विक्रम का मौन टूटा, बेताल जोर से हँसा और हवा में उड़कर पुनः उसी पुराने बरगद के पेड़ पर जा लटका।""",
    },
]

@router.get("/samples")
def get_sample_stories():
    return SAMPLE_STORIES

@router.get("/models")
def get_model_status():
    return {
        "gemini": {
            "configured": bool(settings.GEMINI_API_KEY),
            "main_model": settings.GEMINI_MODEL_MAIN,
            "fallback_models": settings.GEMINI_FALLBACK_MODELS,
        },
        "groq": {
            "configured": bool(settings.GROQ_API_KEY),
            "main_model": settings.GROQ_MODEL_MAIN,
            "light_model": settings.GROQ_MODEL_LIGHT,
            "fallback_models": settings.GROQ_FALLBACK_MODELS,
        },
        "preferred_provider": settings.PREFERRED_PROVIDER,
    }

@router.post("/projects")
async def create_project(req: CreateProjectRequest):
    if not req.raw_story or not req.raw_story.strip():
        raise HTTPException(status_code=400, detail="raw_story is required")

    project_id = f"proj_{int(time.time() * 1000)}"
    now = datetime.utcnow().isoformat() + "Z"

    project = Project(
        status=ProjectStatus(
            project_id=project_id,
            status="pending",
            stage_completed=-1,
            requested_duration_seconds=req.requested_duration_seconds or 600,
            target_language=req.target_language or "en",
        ),
        raw_story=req.raw_story.strip(),
        created_at=now,
        updated_at=now,
    )

    project_store.save_project(project)
    await pipeline_orchestrator.start_pipeline(project_id)
    return project

@router.get("/projects")
def list_projects():
    projects = project_store.list_projects()
    return [p.model_dump() for p in projects]

@router.get("/projects/{project_id}")
def get_project(project_id: str):
    project = project_store.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.model_dump()

@router.delete("/projects/{project_id}")
def delete_project(project_id: str):
    success = project_store.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found or could not be deleted")
    return {"success": True, "project_id": project_id}

@router.post("/projects/{project_id}/resume")
async def resume_project(project_id: str, req: ResumeProjectRequest):
    try:
        await pipeline_orchestrator.resume_pipeline(
            project_id,
            {"characters": req.characters, "locations": req.locations},
        )
        return {"success": True, "message": "Pipeline resumed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/projects/{project_id}/cancel")
def cancel_project(project_id: str):
    success = pipeline_orchestrator.cancel_pipeline(project_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to cancel pipeline")
    return {"success": True, "message": "Pipeline cancelled"}

@router.post("/projects/{project_id}/clarify")
async def submit_clarification(project_id: str, req: SubmitClarificationRequest):
    try:
        await pipeline_orchestrator.submit_clarification(project_id, req.clarification_id, req.answer)
        return {"success": True, "message": "Clarification submitted and pipeline resumed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/projects/{project_id}/events")
async def project_sse_events(project_id: str):
    queue = pipeline_orchestrator.subscribe_sse(project_id)

    async def event_generator():
        try:
            while True:
                item = await queue.get()
                event_name = item.get("event", "message")
                data_json = json.dumps(item.get("data", {}))
                yield f"event: {event_name}\ndata: {data_json}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            pipeline_orchestrator.unsubscribe_sse(project_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@router.get("/projects/{project_id}/export/json")
def export_json(project_id: str):
    project = project_store.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content = json.dumps(project.model_dump(), indent=2, ensure_ascii=False)
    filename = f"{project.story_bible.title if project.story_bible else 'story'}_{project_id}.json".replace(" ", "_")
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/projects/{project_id}/export/script")
def export_screenplay_script(project_id: str):
    project = project_store.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    lines = []
    lines.append("=" * 70)
    title = project.story_bible.title if project.story_bible else "CINEMATIC SCREENPLAY SCRIPT"
    lines.append(f"TITLE: {title.upper()}")
    if project.story_bible:
        lines.append(f"GENRE: {project.story_bible.genre}")
        lines.append(f"THEME: {project.story_bible.theme}")
        lines.append(f"LOGLINE: {project.story_bible.summary}")
    lines.append(f"TOTAL ESTIMATED RUNTIME: {project.status.requested_duration_seconds} SECONDS")
    lines.append("=" * 70)
    lines.append("\n" + "-" * 70 + "\n")

    for i, scene in enumerate(project.scenes):
        lines.append(f"SCENE {i + 1}: {scene.scene_title.upper()}")
        lines.append(f"LOCATION: {scene.location_id} | TIME: {scene.time_of_day.upper()} | DURATION: {scene.duration_seconds}s | MOOD: {scene.emotion.upper()}")
        lines.append(f"TRANSITION: {scene.transition}")
        lines.append("-" * 40)
        lines.append(f"ACTION / WHAT HAPPENS:\n{scene.what_happens}\n")
        lines.append(f"NARRATION (VOICE OVER):\n{scene.narration}\n")
        if scene.dialogue:
            lines.append("DIALOGUE:")
            for d in scene.dialogue:
                lines.append(f"  {d.speaker.upper()} ({d.emotion or 'delivery'}):")
                lines.append(f'    "{d.text}"')
            lines.append("")
        lines.append(f"IMAGE PROMPT (AI):\n{scene.image_prompt}\n")
        lines.append(f"VIDEO PROMPT (AI):\n{scene.video_prompt}\n")
        lines.append("=" * 70 + "\n")

    content = "\n".join(lines)
    filename = f"{title}_{project_id}_script.txt".replace(" ", "_")
    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/projects/{project_id}/export/prompts")
def export_prompts_csv(project_id: str):
    project = project_store.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Scene #",
        "Scene Title",
        "Duration (s)",
        "Location",
        "Time of Day",
        "Dominant Emotion",
        "Image Prompt",
        "Video Prompt",
        "Narration",
    ])

    for i, scene in enumerate(project.scenes):
        writer.writerow([
            i + 1,
            scene.scene_title,
            scene.duration_seconds,
            scene.location_id,
            scene.time_of_day,
            scene.emotion,
            scene.image_prompt,
            scene.video_prompt,
            scene.narration,
        ])

    content = output.getvalue()
    filename = f"{project_id}_prompts.csv"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
