import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AgentFinding(Base):
    __tablename__ = "agent_findings"
    __table_args__ = (
        Index("ix_agent_findings_analysis_agent", "analysis_result_id", "agent_name"),
        Index("ix_agent_findings_chunk_id", "chunk_id"),
        Index("ix_agent_findings_risk_level", "risk_level"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_result_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analysis_results.id", ondelete="CASCADE"), nullable=False)
    chunk_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chunks.id", ondelete="SET NULL"), nullable=True)
    agent_name: Mapped[str] = mapped_column(String(80), nullable=False)
    clause_type: Mapped[str] = mapped_column(String(120), nullable=False, default="Unspecified")
    finding_type: Mapped[str] = mapped_column(String(80), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_quote: Mapped[str] = mapped_column(Text, nullable=False)
    verification_status: Mapped[str] = mapped_column(String(40), nullable=False)
    severity_score: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(24), nullable=False)
    structured_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    analysis_result = relationship("AnalysisResult", back_populates="findings")
    chunk = relationship("Chunk", back_populates="findings")

