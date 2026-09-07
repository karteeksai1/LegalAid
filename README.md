# LegalAid

Explainable multi-agent AI framework for adversarial legal document review and vulnerability analysis.

LegalAid is a monorepo for a legal stress-testing platform that reviews uploaded contracts and legal documents through multiple specialized AI agents. The system is designed to surface exploitable clauses, drafting weaknesses, compliance gaps, citation issues, and aggregate risk scores with source-grounded evidence.

## What This Project Does

LegalAid takes a legal document and runs it through a structured review pipeline:

1. Upload and validate the document through the backend.
2. Extract text with OCR and document parsing in the AI microservice.
3. Chunk legal text with page, clause, party, and token metadata.
4. Store searchable vectors in Pinecone with deterministic source metadata.
5. Dispatch parallel Groq-powered legal agents.
6. Validate that findings are grounded in retrieved document context.
7. Merge agent findings into a consensus risk score and report.
8. Present a review dashboard and downloadable report in the web app.

The AI layer is intentionally guardrailed. Agents must cite retrieved text, keep document content out of system prompts, return structured JSON, and use `VERIFICATION_UNAVAILABLE` when evidence cannot be verified.

## System Architecture

```text
Document Upload (PDF / Scan / Agreement)
│
▼
Express Gateway (JWT Auth, Multipart Upload & File Validation)
│
▼
FastAPI Document Ingestion Core
├── PyMuPDF / Tesseract OCR Text Extraction
└── Pre-Flight Contract Classifier (Contract vs Non-Contract / Template)
│
▼
Semantic Legal Chunking (Clause classification, Parties, Page index)
│
▼
RAG Ingestion (Pinecone Hybrid Vectors + Neon PostgreSQL Chunk Records)
│
▼
Parallel Multi-Agent Review Panel (Groq LLM)
├── Risk & Liability Counsel (Liabilities, loopholes & exposure)
├── Opposing Counsel (Adversarial stress-test & exploit vectors)   ── parallel
├── Transaction Counsel (Drafting clarity, negotiation levers)
├── Neutral Legal Reviewer (Court enforceability & case law)
└── Regulatory & Compliance Counsel (Statutory obligations & filings)
│
▼
Legal Evidence & Citation Reviewer (Source text grounding & anti-hallucination check)
│
▼
Legal Synthesis Engine (Cross-agent arbitration, conflict resolution & 0-100 score)
│
▼
Interactive React Dashboard (Dual Simple/Standard Modes + Grounded Q&A Chat)
```

## What Makes This Different From Existing Tools

| Capability | LegalAid | ChatGPT / Claude | Ironclad / DocuSign | Robin AI / Spellbook |
| :--- | :---: | :---: | :---: | :---: |
| **Multi-agent adversarial review** | ✅ | ❌ | ❌ | Partial |
| **Source-grounded verbatim citations** | ✅ | Partial | Partial | ✅ |
| **Pre-flight contract classifier** | ✅ | ❌ | ✅ | Partial |
| **Dual-mode presentation (Simple / Standard)** | ✅ | ❌ | ❌ | ❌ |
| **Cross-agent consensus arbitration** | ✅ | ❌ | ❌ | Partial |
| **Conversational synonym RAG Q&A** | ✅ | ❌ | ❌ | Partial |
| **Anti-hallucination & anti-injection guardrails** | ✅ | Partial | ❌ | Partial |
| **Deterministic 0–100 risk scoring** | ✅ | ❌ | ✅ (rule-only) | Partial |
| **Per-user document persistence & lifecycle** | ✅ | ❌ | ✅ | ✅ |
| **Open microservice architecture (self-hostable)** | ✅ | ❌ | ❌ | ❌ |

## Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons, TypeScript |
| **Gateway / Auth** | Express.js, Node.js, JWT, Multer (multipart handling) |
| **AI Microservice** | FastAPI, Python 3.11+, Pydantic Settings, Uvicorn |
| **LLM Inference** | Groq API (`openai/gpt-oss-120b` / Llama-3 family, ultra-low latency) |
| **Document Extraction** | PyMuPDF (fitz), Tesseract OCR, pdf2image, Poppler |
| **Vector Store** | Pinecone (dense semantic embeddings, per-document namespaces) |
| **Multi-Agent Orchestration** | 5 Specialist Counsel Agents + Legal Evidence Reviewer |
| **Synthesis & Arbitration** | Legal Synthesis Engine (deterministic consensus & 0–100 risk scoring) |
| **Database** | Neon PostgreSQL (SQLAlchemy 2.0, psycopg3 driver) |
| **Security Guardrails** | Strict Injection Blocker, Citation Hallucination Filter, Intent Gate |
| **Deployment** | Vercel (Frontend), Render / Railway / Docker (Backend & AI Microservice) |

## Prerequisites

Install these locally:

- Node.js 22+
- pnpm 9+
- Python 3.11+
- PostgreSQL-compatible Neon database URL

For later OCR phases:

- Tesseract OCR
- Poppler, required by `pdf2image`

macOS examples:

```bash
brew install node pnpm python@3.11
brew install tesseract poppler
```

## Environment Setup

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Update these values:

```bash
DATABASE_URL="postgresql+psycopg://user:password@host/database?sslmode=require"
GATEWAY_DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
JWT_SECRET="replace-with-at-least-16-characters"
FASTAPI_BASE_URL="http://localhost:8000"
GATEWAY_PORT="3000"
GROQ_API_KEY="your-groq-api-key"
GROQ_MODEL="openai/gpt-oss-120b"
PINECONE_API_KEY="your-pinecone-api-key"
PINECONE_INDEX_NAME="legal-aid-documents"
```

Notes:

- `DATABASE_URL` is used by the Python AI service and should include the SQLAlchemy psycopg dialect.
- `GATEWAY_DATABASE_URL` is reserved for the Express backend.
- `GROQ_MODEL` is centralized so deprecated Groq models can be replaced without changing agent code.
- Pinecone and OCR keys/tools are reserved for later phases and are not required for the current health-check scaffold.

## Install Dependencies

Install JavaScript workspace dependencies:

```bash
pnpm install
```

Create and activate a Python virtual environment for the AI service:

```bash
cd services/ai
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[test]"
cd ../..
```

If `python3.11` is not the command on your machine, use your installed Python 3.11+ executable.

## Run Locally

Open three terminals from the repository root.

Terminal 1: start the AI microservice.

```bash
cd services/ai
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

AI service health check:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "groq_model": "openai/gpt-oss-120b"
}
```

Terminal 2: start the backend API.

```bash
pnpm dev:backend
```

Backend health check:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "aiService": "http://localhost:8000"
}
```

Terminal 3: start the web app.

```bash
pnpm dev:web
```

Open the Vite URL printed in the terminal, usually:

```text
http://127.0.0.1:5173
```

## Useful Commands

Run all TypeScript builds:

```bash
pnpm build
```

Run all JavaScript workspace tests:

```bash
pnpm test
```

Run AI service tests:

```bash
cd services/ai
source .venv/bin/activate
pytest
```

Compile-check the AI service without installing test dependencies:

```bash
python3 -m compileall services/ai/app services/ai/tests
```

## Database Schema

Phase 1 defines these tables in the AI service SQLAlchemy models:

- `users`
- `documents`
- `chunks`
- `analysis_results`
- `agent_findings`

The schema is documented in [docs/phase1-environment-and-schema.md](docs/phase1-environment-and-schema.md).

Chunk metadata is designed to match the Pinecone retrieval requirements:

- `document_id`
- `chunk_id`
- `page_number`
- `clause_type`
- `party_scope`
- `raw_text`
- `token_count`

## Multi-Agent Review Panel & Legal Synthesis

LegalAid deploys 6 specialized agent personas that review contracts from distinct legal and strategic angles:

1. **Risk & Liability Counsel**: Identifies direct financial liabilities, unfavorable indemnities, liability uncapping, and potential claims against the client.
2. **Opposing Counsel**: Actively stress-tests the agreement from an adversary's perspective to surface exploitable ambiguities, leverage points, and dispute traps.
3. **Transaction Counsel**: Reviews transaction structure, negotiation positioning, drafting quality, and clarity of deal covenants.
4. **Neutral Legal Reviewer**: Independently evaluates competing findings, determines court enforceability, and provides objective assessments.
5. **Regulatory & Compliance Counsel**: Verifies statutory compliance, approvals, filing requirements, and jurisdiction-specific regulatory exposures.
6. **Legal Evidence & Citation Reviewer**: Audits claims against verbatim document excerpts and legal authority to prevent hallucination.

### Legal Synthesis Engine
The **Legal Synthesis Engine** reconciles conflicting perspectives across the agent panel:
- Weighs competing arguments using domain-specific legal arbitration rules.
- Computes a deterministic 0–100 aggregate contract risk score.
- Generates dual-track reports: an executive **Plain English** summary for clients and an exhaustive **Standard Audit Trail** for legal counsel.

---

## Interactive Q&A & Guardrails

- **Conversational Layperson Mapping**: Powered by an intelligent synonym engine (`SYNONYM_MAP`), users can ask questions in everyday informal phrasing (e.g. *"Can they cancel on me without warning?"*, *"Can they just drop me?"*, *"Do I have to pay if they mess up?"*, *"Can they steal my code?"*), which automatically resolve to underlying legal clauses (Termination, Notice, Indemnity, IP).
- **Friendly & Varied Off-Topic Refusals**: Off-topic queries receive warm, conversational redirections toward contract terms rather than repetitive robotic scripts.
- **Litigation Prediction Differentiation**: Questions asking to predict court outcomes (e.g. *"Can I win this thing?"*) receive tailored guidance clarifying that LegalAid evaluates contract provisions rather than predicting litigation outcomes.
- **Strict Security Guardrails**: Built-in regex and semantic interceptors block prompt injection attempts, system prompt leaks, and demands for fabricated court citations.

---

## Document Validation & Lifecycle

- **Pre-Flight Contract Classifier**: Validates whether uploaded files are genuine contracts with binding obligations (versus non-legal documents like personal IDs or receipts) and seamlessly handles unfilled contract templates (e.g. standard NDAs with blank signature fields).
- **Persistent Multi-Session Lifecycle**: Documents, analysis findings, and chat histories persist across user logout/login sessions in Neon PostgreSQL, with hard cascading database deletes when documents are removed.

