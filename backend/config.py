import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PORT: int = int(os.environ.get("PORT", "3000"))
    NODE_ENV: str = os.environ.get("NODE_ENV", "development")
    
    @property
    def GEMINI_API_KEY(self) -> str:
        return os.environ.get("GEMINI_API_KEY", "").strip()
        
    @property
    def GROQ_API_KEY(self) -> str:
        return os.environ.get("GROQ_API_KEY", "").strip()
        
    GROQ_MODEL_MAIN: str = os.environ.get("GROQ_MODEL_MAIN", "openai/gpt-oss-120b")
    GROQ_MODEL_LIGHT: str = os.environ.get("GROQ_MODEL_LIGHT", "openai/gpt-oss-20b")
    
    GROQ_FALLBACK_MODELS: list[str] = [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.6-27b",
        "groq/compound",
        "groq/compound-mini",
    ]
    
    GEMINI_MODEL_MAIN: str = "gemini-3.1-flash-lite"
    GEMINI_FALLBACK_MODELS: list[str] = [
        "gemini-3.7-flash",
        "gemini-flash-latest",
        "gemini-3.1-pro-preview",
    ]
    
    STORAGE_PATH: str = os.environ.get(
        "STORAGE_PATH",
        str(Path(__file__).parent.parent / "storage")
    )
    
    DEFAULT_DURATION_SECONDS: int = int(os.environ.get("DEFAULT_DURATION_SECONDS", "600"))
    
    @property
    def PREFERRED_PROVIDER(self) -> str:
        return "groq" if self.GROQ_API_KEY else "gemini"

settings = Settings()
