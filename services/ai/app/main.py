from fastapi import FastAPI

from app.core.config import get_settings


app = FastAPI(title="LegalAid AI Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "groq_model": settings.groq_model}

