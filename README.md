# Story to Video Script AI Engine

A production-grade, multi-stage LLM pipeline architecture built with **Python FastAPI** and **React** to transform raw narrative stories into cinematic video scripts, complete with character bibles, scene breakdowns, shot lists, audio cues, and visual generation prompts.

---

## Architecture Overview

The system processes long-form narratives through a structured 12-stage transformation pipeline:

1. **Stage 0: Ground Truth Extraction & Entity Resolution** - Analyzes characters, locations, chronological events, and story facts with ambiguity detection and SHA-256 state locking.
2. **Stage 1: Section Splitting & Language Detection** - Segments stories into coherent blocks and auto-detects language scripts (Gujarati, Hindi, English, etc.).
3. **Stage 2: Section Tone & Rhythm Extraction** - Extracts emotional arcs, pacing, and tone per section.
4. **Stage 3: Story Bible & World Building** - Creates titles, loglines, themes, and cultural context.
5. **Stage 4: Character & Location Profiles (Human Checkpoint)** - Builds psychological profiles and cinematography visual references with human verification.
6. **Stage 5: Scene Breakdown & Event Coverage** - 1-to-1 event mapping ensuring 100% story coverage.
7. **Stage 6: Timeline & Scene Duration Normalization** - Mathematically normalizes pacing to meet exact requested runtime.
8. **Stage 7: Narration & Locked Dialogue Writing** - Drafts 3rd-person voiceover and enforces verbatim canonical dialogue.
9. **Stage 8: Cinematic Image & Video Prompts** - Constructs production prompts for Midjourney / Flux / Runway Gen-3 / Sora.
10. **Stage 9: Deterministic Consistency Validation** - Audits visual prompt entities against canonical characters and locations.
11. **Stage 10: Semantic Script Translation** - Provides localized cross-lingual translation preserving emotional cadence.
12. **Stage 11: Screenplay Fidelity & Judge Audit** - Automated LLM-as-a-judge scoring narrative fidelity, hallucinations, and plot consistency.

---

## Tech Stack

- **Backend**: Python 3.10+ with **FastAPI**, **Uvicorn**, **Pydantic V2**, **asyncio**, and Server-Sent Events (SSE).
- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Motion.
- **AI / LLM Integration**: Multi-provider resilient fallback engine supporting Google Gemini & Groq with automatic retry, JSON repair, and rate-limit backoff.
- **Persistence**: File-based JSON project store with atomic writes and SHA-256 checksums.

---

## Getting Started

### 1. Environment Configuration
Copy the sample environment file and configure your API keys:

```bash
cp .env.example .env
```

Set the following variables in `.env`:
```env
GEMINI_API_KEY="your_gemini_api_key"
GROQ_API_KEY="your_groq_api_key"   # Optional
PORT=3000
```

---

### 2. Python Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run the FastAPI server directly
python run.py
# Or with uvicorn:
# uvicorn backend.main:app --host 0.0.0.0 --port 3000 --reload
```

---

### 3. Frontend Setup (React + Vite)

```bash
# Install Node dependencies
npm install

# Build static assets for production (served automatically by FastAPI)
npm run build
```

---

## Railway & Cloud Deployment

### Deployment Steps:
1. Push this repository to your GitHub repository.
2. In [Railway.app](https://railway.app/), create a **New Project** and select **Deploy from GitHub repo**.
3. In Railway **Variables**, add:
   - `GEMINI_API_KEY`: Your Gemini API key
   - `GROQ_API_KEY`: (Optional) Your Groq API key
   - `PORT`: `3000` (or leave default assigned by Railway)
4. Railway will automatically detect the configuration from `railway.json` and `Procfile`, build the frontend assets, and launch the Python FastAPI backend.

