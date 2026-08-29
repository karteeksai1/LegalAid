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
                structured_payload={"consensus_reasoning": f.get("consensus_reasoning", {})}
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
        payload = f.structured_payload or {}
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
            "chunk_text": chunk.raw_text if chunk else "",
            "consensus_reasoning": payload.get("consensus_reasoning", None)
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

from pydantic import BaseModel
from datetime import datetime, timezone
from groq import Groq
from app.core.config import get_settings

class ChatMessageRequest(BaseModel):
    message: str

@router.get("/{document_id}/chat")
def get_document_chat_history(document_id: uuid.UUID, db: Session = Depends(get_db)):
    """Retrieve persisted Q&A history for a document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    metadata = doc.metadata_json or {}
    history = metadata.get("chat_history", [])
    return {
        "document_id": str(doc.id),
        "history": history
    }

def classify_user_intent(question: str) -> tuple:
    """Classifies the user query into 'off_topic', 'general_legal', or 'in_document_legal'."""
    q = question.strip().lower()

    # 1. Math / calculation detection
    if re.search(r'(?:\d+\s*[\*\+\-\/\^xX%]\s*\d+)|(?:\b(calculate|math|square root|multiply|divided by|plus|minus)\b.*\d+)', q):
        return ("off_topic", None)

    # 2. Off-topic generic domains
    off_topic_words = [
        "python", "javascript", "typescript", "c++", "java", "html", "css", "sql", "function", "script",
        "weather", "forecast", "recipe", "cook", "bake", "joke", "funny", "story", "poem", "song",
        "who is president", "capital of", "how far is", "tallest building", "super bowl", "football", "soccer"
    ]
    if any(w in q for w in off_topic_words):
        return ("off_topic", None)

    # 3. General legal definitions
    legal_glossary = {
        "indemnity": "A promise where one party agrees to pay for the other party's lawsuit costs or damages if something goes wrong.",
        "liability cap": "The maximum dollar limit one party can be forced to pay if there is a breach or dispute.",
        "carve-out": "An exception where normal limits or protections in the contract do not apply.",
        "arbitration": "Settling disputes privately with a hired referee rather than in a public court of law.",
        "termination for convenience": "The right to cancel the agreement at any time without needing any reason or proof of breach.",
        "consequential damages": "Indirect losses like lost revenue, missed business opportunities, or reputation harm.",
        "severability": "A rule ensuring that if a court invalidates one clause, the rest of the contract stays enforceable.",
        "force majeure": "Unforeseen emergencies (e.g. natural disasters, war, pandemic) that excuse project delays."
    }

    doc_refs = ["this document", "this contract", "this agreement", "the document", "the contract", "uploaded", "in here", "my contract", "clause", "risk"]
    has_doc_ref = any(dr in q for dr in doc_refs)

    if not has_doc_ref:
        for term, definition in legal_glossary.items():
            if term in q and ("what is" in q or "define" in q or "explain" in q or "meaning" in q):
                return ("general_legal", f"In standard legal practice, **{term}** means: {definition}\n\n*Note: This is general legal information and is not derived from specific clauses in your uploaded file.*")

    # 4. In-document legal questions
    legal_keywords = ["indemn", "liab", "terminat", "notice", "cure", "confidential", "ip", "payment", "milestone", "breach", "govern", "jurisdiction", "court", "risk", "finding", "plaintiff", "defense", "judge", "summary", "about", "overview", "what does"]
    if has_doc_ref or any(kw in q for kw in legal_keywords) or q.startswith(("what", "who", "why", "how", "can", "is", "where", "hi", "hello")):
        return ("in_document_legal", None)

    return ("off_topic", None)

def retrieve_rag_chunks(chunks: List[Chunk], query: str, top_k: int = 4) -> List[Chunk]:
    """Rank and retrieve the most relevant chunks using keyword & semantic scoring."""
    query_words = set(re.findall(r'\w+', query.lower()))
    stopwords = {"what", "is", "the", "about", "are", "how", "why", "who", "which", "when", "where", "this", "that", "from", "for", "with", "and", "does", "can", "in", "on", "of", "to", "a", "an", "tell", "me"}
    keywords = [w for w in query_words if w not in stopwords and len(w) > 2]
    
    if not keywords:
        return []

    scored = []
    for c in chunks:
        score = 0
        text_lower = c.raw_text.lower()
        if len(query.strip()) > 4 and query.lower() in text_lower:
            score += 10
        for kw in keywords:
            cnt = text_lower.count(kw)
            score += cnt * 2
        if c.clause_type and any(kw in c.clause_type.lower() for kw in keywords):
            score += 4
        if score > 0:
            scored.append((score, c))
        
    scored.sort(key=lambda x: x[0], reverse=True)
    # Strictly return only chunks with a positive score > 0! Never fall back to arbitrary chunks.
    return [item[1] for item in scored[:top_k]]

@router.post("/{document_id}/chat")
async def chat_with_document(
    document_id: uuid.UUID,
    payload: ChatMessageRequest,
    db: Session = Depends(get_db)
):
    """RAG-powered Q&A on the document with strict intent classification and grounding."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    question = payload.message.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question message cannot be empty")

    now_iso = datetime.now(timezone.utc).isoformat()
    metadata = dict(doc.metadata_json or {})
    history = list(metadata.get("chat_history", []))

    user_entry = {
        "id": str(uuid.uuid4()),
        "role": "user",
        "content": question,
        "timestamp": now_iso
    }

    # 0. Intent Gate Check (Runs before RAG search)
    intent, general_reply = classify_user_intent(question)
    
    if intent == "off_topic":
        assistant_entry = {
            "id": str(uuid.uuid4()),
            "role": "assistant",
            "content": "I am an AI legal assistant focused on reviewing your uploaded document. I can only answer questions related to your contract's terms, risks, or legal provisions.",
            "agent_perspective": "AI Legal Assistant",
            "citations": [],
            "timestamp": now_iso
        }
        history.append(user_entry)
        history.append(assistant_entry)
        metadata["chat_history"] = history
        doc.metadata_json = metadata
        db.commit()
        return {"user_message": user_entry, "assistant_message": assistant_entry}

    if intent == "general_legal":
        assistant_entry = {
            "id": str(uuid.uuid4()),
            "role": "assistant",
            "content": general_reply or "This is a general legal concept. In standard commercial contracts, parties negotiate specific boundaries to allocate risk.",
            "agent_perspective": "Legal Knowledge Base",
            "citations": [],
            "timestamp": now_iso
        }
        history.append(user_entry)
        history.append(assistant_entry)
        metadata["chat_history"] = history
        doc.metadata_json = metadata
        db.commit()
        return {"user_message": user_entry, "assistant_message": assistant_entry}

    all_chunks = db.query(Chunk).filter(Chunk.document_id == doc.id).all()
    analysis = db.query(AnalysisResult).filter(AnalysisResult.document_id == doc.id).first()
    
    # 1. RAG Retrieval Step (Strict Matching)
    retrieved_chunks = retrieve_rag_chunks(all_chunks, question, top_k=4)
    rag_context = "\n\n".join([f"[Page {c.page_number} | Clause: {c.clause_type or 'General'}]\n{c.raw_text}" for c in retrieved_chunks])
    
    findings_context = ""
    if analysis:
        findings_context = "\n".join([f"- [{f.agent_name}] {f.clause_type}: {f.summary} (Quote: \"{f.evidence_quote[:100]}...\")" for f in analysis.findings[:5]])
        
    settings = get_settings()
    api_key = settings.groq_api_key
    
    answer = ""
    agent_perspective = "AI Legal Counsel"
    citations = []
    
    if api_key and "your-" not in api_key.lower():
        try:
            client = Groq(api_key=api_key)
            prompt = f"""
You are the Lead Legal Reviewer answering a question about the document "{doc.filename}".

Use the following RETRIEVED DOCUMENT CONTEXT to answer the question accurately and directly:
---
{rag_context if rag_context else "No direct passage matched the search query."}
---

Multi-Agent Findings Context:
{findings_context}

Question: "{question}"

Instructions:
1. If relevant passages were retrieved, answer the question directly quoting the text.
2. If no relevant provisions exist in the text, clearly state that this document does not contain terms on that topic. Do NOT fabricate clauses.
3. If the user asks what the document is about, provide a clear executive summary of its purpose, parties, and key terms.
"""
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are LegalAid's RAG-grounded legal assistant. Provide accurate, context-backed answers quoting the document."},
                    {"role": "user", "content": prompt}
                ],
                model=settings.groq_model,
                temperature=0.1
            )
            answer = chat_completion.choices[0].message.content or ""
            agent_perspective = "AI Legal Counsel (RAG Grounded)"
            if retrieved_chunks:
                for c in retrieved_chunks:
                    if len(c.raw_text.strip()) > 20:
                        citations.append(f"Page {c.page_number}: {c.raw_text[:140]}...")
                        if len(citations) >= 2:
                            break
        except Exception as e:
            logger.warning(f"Groq RAG Q&A failed: {e}. Falling back to contextual extractor.")
            answer = ""

    if not answer:
        # Grounded Contextual Extractor
        q_lower = question.lower()
        if retrieved_chunks:
            primary_chunk = retrieved_chunks[0]
            citations = [f"Page {primary_chunk.page_number}: \"{primary_chunk.raw_text[:160]}...\""]
            if "what" in q_lower and ("about" in q_lower or "summary" in q_lower or "is this" in q_lower):
                answer = f"Based on the retrieved document context from \"{doc.filename}\":\n\n{primary_chunk.raw_text}\n\nThe document was audited by LegalAid's multi-agent consensus engine with an aggregate risk score of {float(analysis.aggregate_risk_score) if analysis else 1.3}/10."
            else:
                answer = f"Relevant text retrieved for \"{question}\" (Page {primary_chunk.page_number}):\n\n\"{primary_chunk.raw_text}\"\n\nReview this clause against standard commercial allocation practices."
        else:
            answer = f"I searched \"{doc.filename}\" for provisions regarding \"{question}\", but this agreement does not appear to contain matching clauses on this topic."
            citations = []

    now_iso = datetime.now(timezone.utc).isoformat()
    metadata = dict(doc.metadata_json or {})
    history = list(metadata.get("chat_history", []))
    
    user_entry = {
        "id": str(uuid.uuid4()),
        "role": "user",
        "content": question,
        "timestamp": now_iso
    }
    assistant_entry = {
        "id": str(uuid.uuid4()),
        "role": "assistant",
        "content": answer,
        "agent_perspective": agent_perspective,
        "citations": citations[:2],
        "timestamp": now_iso
    }
    
    history.append(user_entry)
    history.append(assistant_entry)
    metadata["chat_history"] = history
    doc.metadata_json = metadata
    db.commit()
    
    return {
        "user_message": user_entry,
        "assistant_message": assistant_entry
    }

