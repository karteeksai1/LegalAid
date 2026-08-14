from app.core.config import Settings
from app.db.base import Base
from app.models import AgentFinding, AnalysisResult, Chunk, Document, User


def test_default_groq_model_is_current_recommended_production_model() -> None:
    settings = Settings(DATABASE_URL="postgresql+psycopg://user:pass@example.com/db?sslmode=require")
    assert settings.groq_model == "openai/gpt-oss-120b"


def test_required_tables_are_registered() -> None:
    assert set(Base.metadata.tables) == {
        "agent_findings",
        "analysis_results",
        "chunks",
        "documents",
        "users",
    }


def test_chunk_metadata_fields_match_pinecone_requirements() -> None:
    columns = Chunk.__table__.columns
    for field in ["document_id", "chunk_id", "page_number", "clause_type", "party_scope", "raw_text", "token_count"]:
        assert field in columns


def test_core_relationships_exist() -> None:
    assert User.documents.property.mapper.class_ is Document
    assert Document.chunks.property.mapper.class_ is Chunk
    assert Document.analysis_results.property.mapper.class_ is AnalysisResult
    assert AnalysisResult.findings.property.mapper.class_ is AgentFinding

