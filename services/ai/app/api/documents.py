import hashlib
import io
import uuid
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from pypdf import PdfReader

from app.db.session import get_db
from app.models.document import Document
from app.models.chunk import Chunk
from app.models.analysis import AnalysisResult
from app.models.finding import AgentFinding
from app.models.user import User
from app.services.analyzer import analyze_document_content

router = APIRouter(prefix="/documents", tags=["documents"])
logger = logging.getLogger(__name__)

def get_or_create_default_user(db: Session) -> User:
    """Gets or creates a default system user to own uploaded documents."""
    default_email = "system-reviewer@legalaid.com"
    user = db.query(User).filter(User.email == default_email).first()
    if not user:
        user = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
            email=default_email,
            password_hash="system-static-hash",
            role="reviewer"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def extract_text(file_content: bytes, content_type: str) -> tuple[str, int]:
    """Extracts text and page count from files."""
    if "pdf" in content_type.lower():
        try:
            pdf = PdfReader(io.BytesIO(file_content))
            page_texts = []
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    page_texts.append(t)
            return "\n\n".join(page_texts), len(pdf.pages)
        except Exception as e:
            logger.error(f"Failed to read PDF text: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Malformed or encrypted PDF document."
            )
    else:
        # Assume text file
        try:
            text = file_content.decode("utf-8")
            # Estimate pages (roughly 3000 characters per page)
            pages = max(1, len(text) // 3000)
            return text, pages
        except Exception as e:
            logger.error(f"Failed to decode text file: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unable to decode file content as text."
            )

def chunk_document_text(text: str) -> List[Dict[str, Any]]:
    """Segments raw text into structured paragraph chunks."""
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
        
        if current_len > 3000:
            page_number += 1
            
    if current_chunk:
        raw_text = "\n\n".join(current_chunk)
        chunks.append({
            "chunk_id": chunk_idx,
            "page_number": page_number,
            "raw_text": raw_text,
            "token_count": max(1, len(raw_text) // 4)
        })
        
    return chunks

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # 1. Read file content
    content = await file.read()
    sha256 = hashlib.sha256(content).hexdigest()
    
    # 2. Check if already exists to avoid redundant analysis
    existing = db.query(Document).filter(Document.sha256 == sha256).first()
    if existing:
        # Check if analysis results exist
        analysis = db.query(AnalysisResult).filter(AnalysisResult.document_id == existing.id).first()
        if analysis:
            return {
                "message": "Document already processed",
                "document_id": str(existing.id),
                "filename": existing.filename,
                "status": existing.status,
                "risk_score": float(analysis.aggregate_risk_score)
            }
        # If document exists but not analyzed, we proceed to analyze it
        doc_id = existing.id
    else:
        doc_id = uuid.uuid4()
        
    # 3. Get Default User
    user = get_or_create_default_user(db)
    
    # 4. Extract text
    raw_text, page_count = extract_text(content, file.content_type)
    
    try:
        # Create Document record if it doesn't exist
        if not existing:
            document = Document(
                id=doc_id,
                owner_id=user.id,
                filename=file.filename,
                content_type=file.content_type or "application/octet-stream",
                storage_uri=f"local://{doc_id}",
                sha256=sha256,
                status="processing",
                page_count=page_count,
                metadata_json={}
            )
            db.add(document)
            db.commit()
        else:
            document = existing
            document.status = "processing"
            db.commit()
            
        # 5. Save chunks
        db.query(Chunk).filter(Chunk.document_id == doc_id).delete()
        db.commit()
        
        chunk_data_list = chunk_document_text(raw_text)
        db_chunks = []
        for idx, item in enumerate(chunk_data_list):
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
        
        # 6. Analyze document content
        analysis_data = analyze_document_content(db_chunks)
        
        # 7. Write AnalysisResult
        db.query(AnalysisResult).filter(AnalysisResult.document_id == doc_id).delete()
        db.commit()
        
        analysis_id = uuid.uuid4()
        analysis = AnalysisResult(
            id=analysis_id,
            document_id=doc_id,
            aggregate_risk_score=analysis_data["aggregate_risk_score"],
            risk_level=analysis_data["risk_level"],
            critical_count=analysis_data["critical_count"],
            high_count=analysis_data["high_count"],
            medium_count=analysis_data["medium_count"],
            low_count=analysis_data["low_count"],
            consensus_report=analysis_data["consensus_report"]
        )
        db.add(analysis)
        
        # 8. Write AgentFindings
        for f in analysis_data["findings"]:
            # Find chunk reference matching the chunk_id field
            target_chunk = next((c for c in db_chunks if c.id == f["chunk_id"]), None)
            finding = AgentFinding(
                id=uuid.uuid4(),
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
                structured_payload={}
            )
            db.add(finding)
            
        document.status = "completed"
        db.commit()
        
        return {
            "message": "Analysis completed successfully",
            "document_id": str(doc_id),
            "filename": file.filename,
            "status": "completed",
            "risk_score": float(analysis.aggregate_risk_score),
            "risk_level": analysis.risk_level
        }
    except Exception as e:
        logger.error(f"Error during document ingestion pipeline: {e}")
        # Mark document as failed
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "failed"
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion and analysis pipeline failed: {str(e)}"
        )

@router.get("", response_model=List[Dict[str, Any]])
def list_documents(db: Session = Depends(get_db)):
    """List all uploaded documents."""
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    results = []
    for doc in docs:
        analysis = db.query(AnalysisResult).filter(AnalysisResult.document_id == doc.id).first()
        results.append({
            "id": str(doc.id),
            "filename": doc.filename,
            "content_type": doc.content_type,
            "status": doc.status,
            "page_count": doc.page_count,
            "created_at": doc.created_at.isoformat(),
            "risk_score": float(analysis.aggregate_risk_score) if analysis else None,
            "risk_level": analysis.risk_level if analysis else None
        })
    return results

@router.get("/{document_id}")
def get_document(document_id: uuid.UUID, db: Session = Depends(get_db)):
    """Retrieve details of a single document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    analysis = db.query(AnalysisResult).filter(AnalysisResult.document_id == doc.id).first()
    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "content_type": doc.content_type,
        "status": doc.status,
        "page_count": doc.page_count,
        "created_at": doc.created_at.isoformat(),
        "risk_score": float(analysis.aggregate_risk_score) if analysis else None,
        "risk_level": analysis.risk_level if analysis else None
    }

@router.get("/{document_id}/analysis")
def get_analysis_results(document_id: uuid.UUID, db: Session = Depends(get_db)):
    """Retrieve multi-agent findings and consensus reports."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    analysis = db.query(AnalysisResult).filter(AnalysisResult.document_id == doc.id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis results not yet generated")
        
    # Get findings with corresponding raw text
    findings = []
    for f in analysis.findings:
        chunk = db.query(Chunk).filter(Chunk.id == f.chunk_id).first()
        findings.append({
            "id": str(f.id),
            "agent_name": f.agent_name,
            "clause_type": f.clause_type,
            "finding_type": f.finding_type,
            "summary": f.summary,
            "evidence_quote": f.evidence_quote,
            "verification_status": f.verification_status,
            "severity_score": f.severity_score,
            "confidence": float(f.confidence),
            "risk_level": f.risk_level,
            "chunk_text": chunk.raw_text if chunk else ""
        })
        
    # Get chunks list
    chunks = db.query(Chunk).filter(Chunk.document_id == doc.id).order_by(Chunk.chunk_id.asc()).all()
    chunk_list = [{
        "id": str(c.id),
        "chunk_id": c.chunk_id,
        "page_number": c.page_number,
        "raw_text": c.raw_text,
        "clause_type": c.clause_type
    } for c in chunks]
    
    return {
        "document": {
            "id": str(doc.id),
            "filename": doc.filename,
            "page_count": doc.page_count,
            "status": doc.status
        },
        "analysis": {
            "id": str(analysis.id),
            "aggregate_risk_score": float(analysis.aggregate_risk_score),
            "risk_level": analysis.risk_level,
            "critical_count": analysis.critical_count,
            "high_count": analysis.high_count,
            "medium_count": analysis.medium_count,
            "low_count": analysis.low_count,
            "consensus_report": analysis.consensus_report
        },
        "findings": findings,
        "chunks": chunk_list
    }
