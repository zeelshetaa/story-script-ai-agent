import crypto from 'crypto';
import { Router } from 'express';
import { pipelineOrchestrator } from '../pipeline/orchestrator.ts';
import { projectStore } from '../storage/projectStore.ts';
import { Project } from '../types.ts';

export const projectRouter = Router();

// Sample stories in Hindi, Gujarati, English for 1-click testing
export const SAMPLE_STORIES = [
  {
    id: 'sample_hindi',
    title: 'विक्रम और बेताल (राजा का न्याय)',
    language: 'hi',
    languageName: 'Hindi',
    story: `उज्जैन के न्यायप्रिय राजा विक्रमादित्य को एक तांत्रिक ने एक घने श्मशान के विशाल बरगद के पेड़ से बेताल नामक शव को लाने का कठिन कार्य सौंपा। 
राजा विक्रम निडर होकर रात के अंधकार में श्मशान पहुंचे। वहां चारों ओर सन्नाटा था और केवल सियार की आवाजें आ रही थीं। राजा ने बरगद के पेड़ पर लटके शव को नीचे उतारा और अपने कंधे पर लाद लिया।

तभी बेताल जाग उठा और उसने कहा, "राजन, तुम्हारा साहस सराहनीय है। मार्ग लंबा है, इसलिए मैं तुम्हें एक रोचक कहानी सुनाता हूँ। परंतु याद रहे, यदि तुमने कहानी के अंत में मेरे प्रश्न का उत्तर जानते हुए भी मौन धारण किया, तो तुम्हारा सिर फट जाएगा, और यदि तुम बोले, तो मैं पुनः पेड़ पर जा लटकूँगा।"

कहानी एक राजकुमारी और तीन योग्य वीरों की थी जिन्होंने राजकुमारी को भयानक राक्षस से बचाया था। कहानी समाप्त कर बेताल ने पूछा, "राजन, राजकुमारी का सच्चा अधिकारी कौन है?" 
राजा विक्रम ने न्याय के धर्म का पालन करते हुए सटीक उत्तर दिया, "जिसने अपनी जान जोखिम में डालकर सबसे पहले युद्ध किया, वही असली वर है।" 
राजा के मुख खोलते ही बेताल ठहाका मारते हुए हवा में उड़ गया और वापस बरगद की शाखा पर लटक गया। विक्रम ने हार नहीं मानी और पुनः पेड़ की ओर बढ़ चले।`,
  },
  {
    id: 'sample_gujarati',
    title: 'શેઠ અને વફાદાર કૂતરો (લાખો વણઝારો)',
    language: 'gu',
    languageName: 'Gujarati',
    story: `ગુજરાતના લોકપ્રિય કિસ્સામાં લાખો વણઝારો ખૂબ પ્રામાણિક વેપારી હતો. એક વખત દુષ્કાળ પડતાં તેને ભારે દેવું થઈ ગયું. તે ગામના ધનિક શેઠ પાસે નાણાં ઉછીના લેવા ગયો.
શેઠે કહ્યું, "લાખા, તારી પાસે ગિરવે મૂકવા જેવું શું છે?" 
લાખા પાસે પોતાના પ્રાણથી પણ વહાલો ડાગિયો કૂતરો હતો. લાખાએ ભારે હૈયે ડાગિયાને શેઠ પાસે ગિરવે મૂક્યો અને વચન આપ્યું કે નાણાં ચૂકવીને તે કૂતરાને પાછો લઈ જશે.

થોડા દિવસો પછી શેઠની હવેલીમાં ચોર ઘૂસ્યા અને મોટી મિલકત ચોરી ગયા. ડાગિયા કૂતરાએ ચોરોનો પીછો કર્યો અને જંગલમાં જે ખાડામાં ચોરોએ ધન છુપાવ્યું હતું તે શેઠને ભસીને બતાવી દીધું. શેઠનું બધું સોનું-ચાંદી પાછું મળી ગયું.
શેઠ ડાગિયાની વફાદારીથી ખુશ થઈ ગયા. તેમણે ડાગિયાના ગળામાં એક ચિઠ્ઠી બાંધી જેમાં લખ્યું કે 'તારા કૂતરાએ મારું બધું ધન બચાવ્યું છે, એટલે તારું દેવું માફ કરું છું અને ડાગિયાને મુક્ત કરું છું.'

જ્યારે લાખો સામેથી આવતો હતો, ત્યારે તેણે દૂરથી ડાગિયાને આવતો જોયો. લાખાને થયું કે કૂતરો વચન તોડીને ભાગી આવ્યો છે. ક્રોધમાં લાખાએ વિચાર્યા વગર ડાગિયાના માથા પર લાકડીનો જોરદાર ફટકો માર્યો. કૂતરો ત્યાં જ ઢળી પડ્યો. 
પછી લાખાની નજર ગળામાં બાંધેલી શેઠની ચિઠ્ઠી પર પડી. સત્ય વાંચીને લાખાના પગ નીચેથી જમીન સરકી ગઈ, પણ હવે ઘણું મોડું થઈ ગયું હતું.`,
  },
  {
    id: 'sample_english',
    title: 'The Last Signal of Kepler-9',
    language: 'en',
    languageName: 'English',
    story: `Commander Elena Vance stood in the observation deck of the deep-space research station Kepler-9, gazing at the pulsating violet nebula of the Cygnus sector. Beside her, Dr. Aaron Kael adjusted the quantum resonance scanner as the consoles hummed with warning tones.

"Elena, the gravitational wave isn't random," Aaron said, pointing at the rhythmic binary spikes on the holographic display. "It's an engineered distress beacon from the uncharted orbital relay."

Elena activated her comm-link to address the crew. "All personnel, prepare the scout vessel Chimera for immediate launch. We investigate the distress origin."

They descended through the ionized atmosphere of the dead moon. The rusted metallic spires of an ancient precursor installation rose from the frozen basalt plains. As Elena and Aaron stepped through the pressurized airlock into the cavernous central vault, the station's AI voice echoed through their helmets: 'Identity confirmed. Temporal transmission initiated.' 

A holographic projection flickered to life, showing an older Elena herself from twenty years in the future, warning them: 'Do not trigger the containment sequence. It is not an engine; it is a cage.' Elena stared in disbelief as the seismic dampers began to fail, forcing a choice between immediate planetary retreat and unlocking the forbidden signal.`,
  },
];

// List sample presets
projectRouter.get('/samples', (req, res) => {
  res.json({ samples: SAMPLE_STORIES });
});

// List all projects
projectRouter.get('/projects', async (req, res) => {
  try {
    const projects = await projectStore.listProjects();
    const summaries = projects.map((p) => ({
      project_id: p.status.project_id,
      status: p.status.status,
      title: p.story_bible?.title || p.raw_story.slice(0, 50) + '...',
      stage_completed: p.status.stage_completed,
      stage_name: p.status.stage_name,
      progress_percent: p.status.progress_percent,
      detected_language: p.status.detected_language,
      target_language: p.status.target_language,
      requested_duration_seconds: p.status.requested_duration_seconds,
      scenes_count: p.scenes?.length || 0,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));
    res.json({ projects: summaries });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list projects' });
  }
});

// Create a new project
projectRouter.post('/projects', async (req, res) => {
  try {
    const { raw_story, target_language = 'en', requested_duration_seconds = 600 } = req.body;

    if (!raw_story || typeof raw_story !== 'string' || raw_story.trim().length === 0) {
      return res.status(400).json({ error: 'raw_story is required and must be non-empty.' });
    }

    const projectId = crypto.randomUUID();

    const newProject: Project = {
      status: {
        project_id: projectId,
        status: 'pending',
        stage_completed: -1,
        stage_running: null,
        requested_duration_seconds: Number(requested_duration_seconds) || 600,
        target_language: target_language || 'en',
        error_message: null,
        progress_percent: 0,
      },
      raw_story: raw_story.trim(),
      sections: [],
      source_of_truth: null,
      story_bible: null,
      characters: [],
      locations: [],
      scenes: [],
      clarifications: [],
      fidelity_issues: [],
      stage_outputs: {},
      logs: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await projectStore.saveProject(newProject);
    res.status(201).json(newProject);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create project' });
  }
});

// Get project by ID
projectRouter.get('/projects/:id', async (req, res) => {
  try {
    const project = await projectStore.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: `Project ${req.params.id} not found` });
    }
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get project' });
  }
});

// Delete project
projectRouter.delete('/projects/:id', async (req, res) => {
  try {
    const ok = await projectStore.deleteProject(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: `Project ${req.params.id} not found` });
    }
    res.json({ success: true, message: 'Project deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete project' });
  }
});

// Start pipeline
projectRouter.post('/projects/:id/start', async (req, res) => {
  try {
    const project = await projectStore.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: `Project ${req.params.id} not found` });
    }

    // Trigger async pipeline execution in background
    pipelineOrchestrator.startPipeline(req.params.id);

    res.json({ success: true, message: 'Pipeline execution started', project_id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to start pipeline' });
  }
});

// Cancel pipeline
projectRouter.post('/projects/:id/cancel', async (req, res) => {
  try {
    const cancelled = await pipelineOrchestrator.cancelPipeline(req.params.id);
    res.json({ success: cancelled, message: cancelled ? 'Pipeline cancelled' : 'Project not active' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to cancel pipeline' });
  }
});

// Resume pipeline from checkpoint
projectRouter.post('/projects/:id/resume', async (req, res) => {
  try {
    const { characters, locations } = req.body;
    await pipelineOrchestrator.resumePipeline(req.params.id, { characters, locations });
    res.json({ success: true, message: 'Pipeline resumed' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to resume pipeline' });
  }
});

// Submit clarification
projectRouter.post('/projects/:id/clarify', async (req, res) => {
  try {
    const { clarification_id, answer } = req.body;
    if (!clarification_id || !answer) {
      return res.status(400).json({ error: 'clarification_id and answer are required' });
    }
    await pipelineOrchestrator.submitClarification(req.params.id, clarification_id, answer);
    res.json({ success: true, message: 'Clarification submitted and pipeline resumed' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to submit clarification' });
  }
});

// SSE Events stream
projectRouter.get('/projects/:id/events', async (req, res) => {
  const projectId = req.params.id;
  const project = await projectStore.getProject(projectId);
  if (!project) {
    return res.status(404).json({ error: `Project ${projectId} not found` });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  pipelineOrchestrator.registerSSEClient(projectId, res);
});

// Export full project JSON
projectRouter.get('/projects/:id/export/json', async (req, res) => {
  try {
    const project = await projectStore.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    res.setHeader('Content-Disposition', `attachment; filename="script_project_${project.status.project_id}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(project, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export Screenplay Text Format
projectRouter.get('/projects/:id/export/script', async (req, res) => {
  try {
    const project = await projectStore.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const bible = project.story_bible;
    const sot = project.source_of_truth;

    let output = `================================================================================\n`;
    output += `TITLE: ${bible?.title || 'CINEMATIC VIDEO SCRIPT'}\n`;
    output += `GENRE: ${bible?.genre || 'Drama'} | THEME: ${bible?.theme || 'N/A'}\n`;
    output += `ESTIMATED RUNTIME: ${project.status.requested_duration_seconds}s (${Math.round(
      project.status.requested_duration_seconds / 60
    )} mins)\n`;
    output += `GROUND TRUTH INTEGRITY: SHA-256 [${sot?.checksum || 'UNLOCKED'}]\n`;
    output += `================================================================================\n\n`;

    output += `LOGLINE / SUMMARY:\n${bible?.summary || 'N/A'}\n\n`;

    output += `CAST OF CHARACTERS:\n`;
    for (const c of project.characters) {
      output += `- ${c.name.toUpperCase()} (${c.role}, ${c.age}): ${c.personality}\n`;
      output += `  Appearance: ${c.appearance}\n`;
      output += `  Attire: ${c.clothing}\n`;
      output += `  Voice: ${c.voice_style}\n\n`;
    }

    output += `\n============================= MASTER SCENE SCRIPT =============================\n\n`;

    project.scenes.forEach((s, idx) => {
      output += `--------------------------------------------------------------------------------\n`;
      output += `SCENE ${idx + 1}: ${s.scene_title.toUpperCase()}\n`;
      output += `EVENT ID: ${s.event_id} | LOCATION: ${s.location_id.toUpperCase()} | TIME: ${s.time_of_day.toUpperCase()} | DURATION: ${s.duration_seconds}s\n`;
      output += `EMOTION: ${s.emotion.toUpperCase()} | TRANSITION: ${s.transition}\n`;
      output += `--------------------------------------------------------------------------------\n\n`;

      output += `ACTION BEAT:\n${s.what_happens}\n\n`;

      output += `NARRATOR (V.O.):\n${s.narration}\n\n`;

      if (s.dialogue.length > 0) {
        output += `DIALOGUE:\n`;
        for (const d of s.dialogue) {
          output += `  ${d.speaker.toUpperCase()} (${d.emotion || 'measured'}):\n`;
          output += `    "${d.text}"\n\n`;
        }
      }

      output += `VISUAL IMAGE PROMPT (Midjourney / Flux):\n${s.image_prompt}\n\n`;
      output += `VIDEO MOTION PROMPT (Runway / Veo / Pika):\n${s.video_prompt}\n\n`;
      output += `\n`;
    });

    res.setHeader('Content-Disposition', `attachment; filename="screenplay_${project.status.project_id}.txt"`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(output);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export Visual Prompts CSV/Text Sheet
projectRouter.get('/projects/:id/export/prompts', async (req, res) => {
  try {
    const project = await projectStore.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    let csv = `Scene Number,Scene Title,Duration (s),Location,Time of Day,Emotion,Image Prompt,Video Prompt\n`;
    project.scenes.forEach((s, idx) => {
      const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
      csv += `${idx + 1},${escape(s.scene_title)},${s.duration_seconds},${escape(s.location_id)},${escape(
        s.time_of_day
      )},${escape(s.emotion)},${escape(s.image_prompt)},${escape(s.video_prompt)}\n`;
    });

    res.setHeader('Content-Disposition', `attachment; filename="production_prompts_${project.status.project_id}.csv"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
