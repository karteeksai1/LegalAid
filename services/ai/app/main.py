from fastapi import FastAPI

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
import app.models  # noqa

from app.api.documents import router as documents_router

app = FastAPI(title="LegalAid AI Service", version="0.1.0")


@app.on_event("startup")
def startup():
    # Automatically create database tables if they do not exist
    Base.metadata.create_all(bind=engine)


app.include_router(documents_router)


@app.get("/health")
def health() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "groq_model": settings.groq_model}

