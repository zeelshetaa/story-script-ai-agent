# Story to Video Script AI Engine

A production-grade, multi-stage LLM pipeline architecture built with TypeScript, Node.js, Express, and React to transform raw narrative stories into cinematic video scripts, complete with character bibles, scene breakdowns, shot lists, audio cues, and visual generation prompts.

---

## Architecture Overview

The system processes long-form narratives through a structured 12-stage transformation pipeline:

1. **Stage 0: Ground Truth Extraction & Entity Resolution** - Analyzes characters, locations, chronological events, and story facts with ambiguity detection.
2. **Stage 1: Sectional Narrative Arc Decomposition** - Segments stories into 3-act / multi-beat story structures.
3. **Stage 2: Scene & Beat Allocation** - Maps target video duration (e.g., 60s, 120s, 300s) to precise scene pacing and beat timing.
4. **Stage 3: Screenplay & Dialogue Formatting** - Drafts Industry-standard screenplays with stage directions, parentheticals, and character dialogue.
5. **Stage 4: Continuity & Fact Verification** - Validates character presence, temporal consistency, and spatial continuity against Ground Truth.
6. **Stage 5: Scene-by-Scene Shot Sequencing** - Creates cinematic shot lists (wide, medium, close-up, camera movement, focal length).
7. **Stage 6: Audio & Foley Design** - Generates music tone descriptions, ambient soundscapes, voiceover tracks, and SFX markers.
8. **Stage 7: Visual & Image Prompts** - Constructs deterministic image generation prompts for Midjourney / Stable Diffusion / Flux with consistent style tokens.
9. **Stage 8: Video Motion Prompts** - Produces camera physics, subject motion, and temporal prompts for Runway Gen-3 / Sora / Kling.
10. **Stage 9: Semantic Script Translation** - Provides localized translation maintaining emotional cadence and colloquial naturalism.
11. **Stage 10: Export Packaging** - Packages scripts into JSON, PDF Screenplay format, Final Draft XML, and SRT subtitles.
12. **Stage 11: LLM Fidelity Evaluation** - Automatic QA judge scoring narrative fidelity, character consistency, and duration compliance.

---

## Tech Stack

- **Backend**: Node.js, TypeScript, Express, ESBuild
- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Motion
- **AI / LLM Integration**: Multi-provider fallback engine supporting Google Gemini & Groq SDK with automatic retry, JSON repair, and rate-limit backoff.
- **Persistence**: File-based JSON project store with atomic writes (customizable to S3 / PostgreSQL / Redis).

---

## Getting Started

### Prerequisites
- Node.js >= 20.x
- npm or bun

### Environment Configuration
Copy the sample environment file and configure your API keys:

```bash
cp .env.example .env
```

Set the following variables in `.env`:
```env
GEMINI_API_KEY="your_gemini_api_key"
GROQ_API_KEY="your_groq_api_key"   # Optional
PORT=3000
NODE_ENV=development
```

### Installation & Local Development

```bash
# Install dependencies
npm install

# Start development server (Full-stack Express + Vite)
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Production Build & Deployment

### Build for Production
```bash
npm run build
```
This produces client static assets in `dist/` and compiles the server into a self-contained bundle at `dist/server.cjs`.

### Start Production Server
```bash
npm run start
```

### Railway / Cloud Deployment
The repository includes `railway.json` and `Procfile` ready for zero-configuration deployments on Railway, Render, Fly.io, or any container environment.
