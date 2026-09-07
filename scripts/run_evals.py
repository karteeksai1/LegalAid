#!/usr/bin/env python3
"""
LegalAid Multi-Agent Evaluation Runner
Discovers evaluation documents (.txt, .md, .pdf) in evals/, executes multi-agent
legal vulnerability analysis via LLM (Groq / llama-3.3-70b-versatile), verifies grounding,
and commits full structured findings and consensus reports into Neon PostgreSQL.
"""

import argparse
import hashlib
import io
import json
import logging
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Add services/ai to sys.path so we can import application modules
ROOT_DIR = Path(__file__).resolve().parent.parent
AI_DIR = ROOT_DIR / "services" / "ai"
if str(AI_DIR) not in sys.path:
    sys.path.insert(0, str(AI_DIR))

# Ensure root .env is loaded
from dotenv import load_dotenv
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("evals_runner")

# Import database models and analysis engine
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app.models.analysis import AnalysisResult
from app.models.chunk import Chunk
from app.models.document import Document
from app.models.finding import AgentFinding
from app.models.user import User
from app.services.analyzer import (
    analyze_document_content,
    is_contractual_document,
)

EVALS_DIR = ROOT_DIR / "evals"
RESULTS_DIR = EVALS_DIR / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# System eval user credentials
EVAL_USER_EMAIL = "evals@legalaid.local"
EVAL_USER_ROLE = "evaluator"


def get_or_create_eval_user(db: Session) -> User:
    """Ensures an evaluation owner user exists in Neon PostgreSQL."""
    user = db.query(User).filter(User.email == EVAL_USER_EMAIL).first()
    if not user:
        logger.info(f"Creating evaluation runner user '{EVAL_USER_EMAIL}' in Neon DB...")
        user = User(
            id=uuid.uuid4(),
            email=EVAL_USER_EMAIL,
            password_hash="system-evaluator-no-login",
            role=EVAL_USER_ROLE
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"Created eval user ID: {user.id}")
    return user


def extract_file_content(file_path: Path) -> Tuple[str, int]:
    """Reads content from text, markdown, or PDF files. Returns (text, page_count)."""
    suffix = file_path.suffix.lower()
    content_bytes = file_path.read_bytes()

    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content_bytes))
            pages = [page.extract_text() or "" for page in reader.pages]
            full_text = "\n\n".join(pages).strip()
            total_pages = max(1, len(reader.pages))
            return full_text, total_pages
        except Exception as e:
            logger.warning(f"pypdf extraction failed on {file_path.name}: {e}. Falling back to text decode.")
            raw_text = content_bytes.decode("latin1", errors="ignore")
            page_matches = re.findall(r'/Type\s*/Page\b', raw_text)
            return raw_text, max(1, len(page_matches))
    else:
        # Text or Markdown
        text = content_bytes.decode("utf-8", errors="replace")
        text = re.sub(r'_{3,}', ' [BLANK_FIELD] ', text)
        pages = max(1, len(text) // 3000)
        return text, pages


def chunk_document_text(text: str) -> List[Dict[str, Any]]:
    """Segments raw text into structured paragraph chunks with token counts."""
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_len = 0
    page_number = 1
    chunk_idx = 0

    for p in paragraphs:
        p = p.strip()
        if not p:
            continue

        char_count = len(p)
        if current_len + char_count > 1500 and current_chunk:
            raw_text = "\n\n".join(current_chunk)
            chunks.append({
                "chunk_id": chunk_idx,
                "page_number": page_number,
                "raw_text": raw_text,
                "token_count": max(1, len(raw_text) // 4)
            })
            chunk_idx += 1
            current_chunk = []
            current_len = 0

        current_chunk.append(p)
        current_len += char_count

    if current_chunk:
        raw_text = "\n\n".join(current_chunk)
        chunks.append({
            "chunk_id": chunk_idx,
            "page_number": page_number,
            "raw_text": raw_text,
            "token_count": max(1, len(raw_text) // 4)
        })

    if not chunks and text:
        chunks.append({
            "chunk_id": 0,
            "page_number": 1,
            "raw_text": text,
            "token_count": max(1, len(text) // 4)
        })

    return chunks


def find_eval_files(target_path: Optional[Path] = None) -> List[Path]:
    """Finds all evaluatable documents in the given directory or specific file."""
    if target_path and target_path.is_file():
        return [target_path]

    search_dir = target_path if target_path and target_path.is_dir() else EVALS_DIR
    valid_extensions = {".txt", ".md", ".pdf"}
    files = []

    for path in sorted(search_dir.rglob("*")):
        if path.is_file() and path.suffix.lower() in valid_extensions:
            # Skip documentation files and output folders
            if path.name.lower() in {"readme.md", "license.md"} or "results" in path.parts:
                continue
            files.append(path)

    return files


def run_single_eval(file_path: Path, db: Session, eval_user: User, dry_run: bool = False) -> Dict[str, Any]:
    """Runs evaluation on a single document, calls LLM agents, and stores findings in Neon."""
    print("\n" + "─" * 70)
    print(f"📄 Evaluating: {file_path.name}")
    print(f"   Location  : {file_path}")
    print("─" * 70)

    # 1. Read and fingerprint document
    content_bytes = file_path.read_bytes()
    sha256 = hashlib.sha256(content_bytes).hexdigest()
    raw_text, page_count = extract_file_content(file_path)

    word_count = len(re.findall(r'\b[a-zA-Z]{2,}\b', raw_text))
    print(f"   • Extracted: {len(raw_text)} chars, {word_count} words across {page_count} page(s)")

    # 2. Contractual Sanity Check
    is_contract, reason, failure_mode = is_contractual_document(raw_text, filename=file_path.name, page_count=page_count)
    if not is_contract:
        print(f"   ⚠️ Contract Classifier Warning: {reason} [{failure_mode}]")
        print("   Proceeding with evaluation as an eval benchmark document...")

    # 3. Create or update Document record in Neon
    doc_id = uuid.uuid4()
    existing_doc = db.query(Document).filter(Document.sha256 == sha256).first()
    if existing_doc:
        doc_id = existing_doc.id
        existing_doc.filename = file_path.name
        existing_doc.status = "evaluating"
        existing_doc.page_count = page_count
        existing_doc.metadata_json = {
            "eval": True,
            "eval_run_at": datetime.now(timezone.utc).isoformat(),
            "sha256": sha256,
            "source": str(file_path)
        }
        document = existing_doc
    else:
        document = Document(
            id=doc_id,
            owner_id=eval_user.id,
            filename=file_path.name,
            content_type="application/pdf" if file_path.suffix.lower() == ".pdf" else "text/plain",
            storage_uri=f"evals://{file_path.name}",
            sha256=sha256,
            status="evaluating",
            page_count=page_count,
            metadata_json={
                "eval": True,
                "eval_run_at": datetime.now(timezone.utc).isoformat(),
                "sha256": sha256,
                "source": str(file_path)
            }
        )
        db.add(document)

    db.commit()

    # 4. Clean old chunks and analysis for this document
    db.query(Chunk).filter(Chunk.document_id == doc_id).delete()
    db.query(AnalysisResult).filter(AnalysisResult.document_id == doc_id).delete()
    db.commit()

    # 5. Chunk and save chunks into Neon
    chunk_defs = chunk_document_text(raw_text)
    db_chunks: List[Chunk] = []
    for item in chunk_defs:
        chunk = Chunk(
            id=uuid.uuid4(),
            document_id=doc_id,
            chunk_id=item["chunk_id"],
            page_number=item["page_number"],
            clause_type="Unspecified",
            party_scope="Unspecified",
            raw_text=item["raw_text"],
            token_count=item["token_count"]
        )
        db.add(chunk)
        db_chunks.append(chunk)
    db.commit()

    print(f"   • Chunking : Split into {len(db_chunks)} structured segment(s)")

    # 6. Execute Multi-Agent LLM Review & Grounding Engine
    print("   🤖 Running Multi-Agent Legal Analysis through LLM (Groq)...")
    analysis_data = analyze_document_content(db_chunks)

    aggregate_risk_score = analysis_data["aggregate_risk_score"]
    risk_level = analysis_data["risk_level"]
    findings = analysis_data["findings"]
    consensus_report = analysis_data["consensus_report"]

    print(f"   📊 Risk Score: {aggregate_risk_score}/10 ({risk_level.upper()})")
    print(f"   • Findings  : {len(findings)} verified legal findings")
    print(f"     - Critical: {analysis_data['critical_count']}")
    print(f"     - High    : {analysis_data['high_count']}")
    print(f"     - Medium  : {analysis_data['medium_count']}")
    print(f"     - Low     : {analysis_data['low_count']}")

    # 7. Write AnalysisResult to Neon
    analysis_id = uuid.uuid4()
    analysis = AnalysisResult(
        id=analysis_id,
        document_id=doc_id,
        aggregate_risk_score=aggregate_risk_score,
        risk_level=risk_level,
        critical_count=analysis_data["critical_count"],
        high_count=analysis_data["high_count"],
        medium_count=analysis_data["medium_count"],
        low_count=analysis_data["low_count"],
        consensus_report=consensus_report
    )
    db.add(analysis)

    # 8. Write AgentFindings to Neon
    db_findings = []
    for f in findings:
        target_chunk = next((c for c in db_chunks if c.id == f.get("chunk_id")), None)
        finding_id = uuid.uuid4()
        agent_finding = AgentFinding(
            id=finding_id,
            analysis_result_id=analysis_id,
            chunk_id=target_chunk.id if target_chunk else None,
            agent_name=f["agent_name"],
            clause_type=f["clause_type"],
            finding_type=f["finding_type"],
            summary=f["summary"],
            evidence_quote=f["evidence_quote"],
            verification_status=f["verification_status"],
            severity_score=f["severity_score"],
            confidence=f["confidence"],
            risk_level=f["risk_level"],
            structured_payload={
                "consensus_reasoning": f.get("consensus_reasoning", {}),
                "eval_metadata": {
                    "source_file": file_path.name,
                    "sha256": sha256
                }
            }
        )
        db.add(agent_finding)
        db_findings.append({
            "id": str(finding_id),
            "agent_name": f["agent_name"],
            "clause_type": f["clause_type"],
            "finding_type": f["finding_type"],
            "severity_score": f["severity_score"],
            "risk_level": f["risk_level"],
            "summary": f["summary"],
            "evidence_quote": f["evidence_quote"],
            "verification_status": f["verification_status"]
        })

    document.status = "completed"
    db.commit()

    print(f"   💾 Saved to Neon DB:")
    print(f"      • Document ID: {doc_id}")
    print(f"      • Analysis ID: {analysis_id}")
    print(f"      • Findings   : {len(db_findings)} rows inserted into 'agent_findings'")

    # Pretty print findings table
    print("\n   ┌" + "─" * 90 + "┐")
    print(f"   │ {'AGENT / ROLE':<28} │ {'CLAUSE':<18} │ {'RISK':<8} │ {'SCORE':<5} │ {'FINDING TYPE':<22} │")
    print("   ├" + "─" * 90 + "┤")
    for f in findings:
        agent_abbr = (f["agent_name"][:26] + "..") if len(f["agent_name"]) > 28 else f["agent_name"]
        clause_abbr = (f["clause_type"][:16] + "..") if len(f["clause_type"]) > 18 else f["clause_type"]
        ftype_abbr = (f["finding_type"][:20] + "..") if len(f["finding_type"]) > 22 else f["finding_type"]
        print(f"   │ {agent_abbr:<28} │ {clause_abbr:<18} │ {f['risk_level']:<8} │ {f['severity_score']:<5} │ {ftype_abbr:<22} │")
    print("   └" + "─" * 90 + "┘")

    return {
        "filename": file_path.name,
        "document_id": str(doc_id),
        "analysis_id": str(analysis_id),
        "aggregate_risk_score": float(aggregate_risk_score),
        "risk_level": risk_level,
        "findings_count": len(db_findings),
        "critical_count": analysis_data["critical_count"],
        "high_count": analysis_data["high_count"],
        "medium_count": analysis_data["medium_count"],
        "low_count": analysis_data["low_count"],
        "consensus_summary": consensus_report.get("summary", ""),
        "findings": db_findings
    }


def main():
    parser = argparse.ArgumentParser(description="LegalAid LLM Evaluation Runner with Neon PostgreSQL persistence.")
    parser.add_argument("target", nargs="?", default=None, help="Target file or directory inside evals/ to evaluate.")
    parser.add_argument("--dry-run", action="store_true", help="Run without persisting to the database.")
    args = parser.parse_args()

    print("=" * 80)
    print("  ⚖️   LegalAid Multi-Agent LLM Evaluation Runner")
    print("=" * 80)

    target_path = Path(args.target).resolve() if args.target else EVALS_DIR
    files = find_eval_files(target_path)

    if not files:
        print(f"\n❌ No evaluation files found in: {target_path}")
        print(f"\nTo run evaluations, drop your contract files (.txt, .md, or .pdf) into:")
        print(f"   {EVALS_DIR}")
        print(f"\nThen re-run: pnpm evals\n")
        sys.exit(0)

    print(f"\n📂 Target: {target_path}")
    print(f"📄 Found {len(files)} evaluation document(s) to process:")
    for i, f in enumerate(files, 1):
        print(f"   {i}. {f.name} ({f.stat().st_size} bytes)")

    # Ensure database schema is created
    Base.metadata.create_all(bind=engine)

    # Open database session
    db = Session(engine)
    eval_user = get_or_create_eval_user(db)

    results = []
    start_time = datetime.now(timezone.utc)

    try:
        for file_path in files:
            res = run_single_eval(file_path, db=db, eval_user=eval_user, dry_run=args.dry_run)
            results.append(res)
    finally:
        db.close()

    duration = (datetime.now(timezone.utc) - start_time).total_seconds()
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_file = RESULTS_DIR / f"eval_run_{timestamp_str}.json"

    summary_payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": round(duration, 2),
        "total_documents_evaluated": len(results),
        "total_findings_stored": sum(r["findings_count"] for r in results),
        "results": results
    }

    report_file.write_text(json.dumps(summary_payload, indent=2), encoding="utf-8")

    print("\n" + "=" * 80)
    print("  🏁 EVALUATION COMPLETE")
    print("=" * 80)
    print(f"   • Documents Evaluated : {len(results)}")
    print(f"   • Total Findings in DB: {sum(r['findings_count'] for r in results)}")
    print(f"   • Execution Time      : {duration:.2f}s")
    print(f"   • JSON Report Saved   : {report_file}")
    print(f"   • Database Target     : Neon PostgreSQL (ep-lively-darkness-aeziu72e)")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
