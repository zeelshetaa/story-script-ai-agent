import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.routes.projects import router as projects_router

app = FastAPI(
    title="Story-to-Video Screenplay API",
    description="12-Stage Deterministic Story-to-Video Screenplay Engine in Python",
    version="1.0.0",
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "backend": "python_fastapi",
        "version": "1.0.0",
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "groq_configured": bool(settings.GROQ_API_KEY),
    }

# Mount API routes
app.include_router(projects_router, prefix="/api")

# Serve React static build in production
dist_dir = Path(__file__).parent.parent / "dist"
if dist_dir.exists() and dist_dir.is_dir():
    # Mount static assets (like /assets)
    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept API routes
        if full_path.startswith("api"):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
            
        file_path = dist_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
            
        index_file = dist_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
            
        return JSONResponse(status_code=404, content={"detail": "Frontend index.html not found"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.PORT)
