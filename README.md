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

```mermaid
flowchart LR
    subgraph S1["1. User & Web UI"]
        A["<b>React Dashboard</b><br/>• Simple & Standard Views<br/>• Interactive Q&A Chat<br/>• Clause Risk Heatmap"]
    end

    subgraph S2["2. Ingestion & Guardrails"]
        B["<b>FastAPI Core</b><br/>• Text & OCR Extraction<br/>• Contract Classifier<br/>• Prompt & Security Filters"]
    end

    subgraph S3["3. Multi-Agent Review"]
        C["<b>Specialist Legal Panel</b><br/>• Risk & Liability Counsel<br/>• Opposing Counsel (Adversarial)<br/>• Transaction & Regulatory<br/>• Neutral Legal Reviewer"]
    end

    subgraph S4["4. Synthesis & Storage"]
        D["<b>Legal Synthesis Engine</b><br/>• 0–100 Consensus Score<br/>• Source-Grounded Citations<br/>• Neon DB & Pinecone Vectors"]
    end

    S1 -->|Upload Contract / Query| S2
    S2 -->|Structured Chunks| S3
    S3 -->|Agent Findings| S4
    S4 -.->|Audited Report & Answers| S1
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

## AI Agent Design

The planned multi-agent system includes:

- Risk & Liability Counsel Agent: identifies liabilities, unfavorable clauses, loopholes, exposures, and potential claims against the client.
- Opposing Counsel Agent: actively probes the contract from an adverse party perspective to surface exploit vectors, leverage points, and dispute traps.
- Transaction Counsel Agent: reviews the agreement from the perspective of transaction structure, negotiation, drafting quality, and opportunities for improvement.
- Neutral Legal Reviewer Agent: independently evaluates competing findings and determines which conclusions are best supported by the evidence and legal authority.
- Regulatory & Compliance Counsel Agent: checks regulatory requirements, statutory obligations, approvals, filing requirements, and compliance risks.
- Legal Evidence & Citation Reviewer Agent: verifies important conclusions against the source agreement and applicable legal authorities, ensuring claims are properly supported.

All agent outputs should be structured, schema-validated, and grounded in retrieved document chunks.

## Figma Prompt

Use this prompt in Figma, FigJam, or an AI design assistant:

```text
Design a serious, professional SaaS web application called LegalAid Review. It is an explainable multi-agent AI platform for adversarial legal document review and vulnerability analysis.

The product helps lawyers, founders, compliance teams, and contract reviewers upload legal documents, run AI-powered stress tests, and see source-grounded risks before signing or sending a contract.

Core workflow:
1. User uploads a PDF or legal document.
2. The system extracts text with OCR, chunks clauses, and indexes evidence.
3. AI agents review the document from specialized perspectives: Risk & Liability Counsel, Opposing Counsel, Transaction Counsel, Neutral Legal Reviewer, and Regulatory & Compliance Counsel.
4. The dashboard shows clause-level findings, exact evidence quotes, verification status, confidence, severity, and consensus risk scores synthesized by the Legal Synthesis Engine.
5. The user can filter findings by clause type, risk level, party scope, agent, and verification status.
6. The user can open a report view and export a structured vulnerability analysis summary.

Design requirements:
- Build the actual app interface, not a marketing landing page.
- Visual tone should be legal, trustworthy, analytical, and modern.
- Avoid playful or overly decorative styling.
- Use a dense but readable SaaS layout with clear navigation and strong information hierarchy.
- First screen should feel like a working legal review dashboard.
- Include left navigation, top document/job status bar, upload action, risk summary, clause heatmap, findings table, agent consensus panel, and source evidence drawer.
- Use restrained colors with high contrast. Suggested palette: white, off-white, ink, muted steel, legal green, amber, and red for severity.
- Use compact cards only for repeated dashboard items; avoid nested cards.
- Show exact evidence snippets and verification badges prominently.
- Include states for processing, completed review, critical findings, and verification unavailable.
- Include responsive desktop and tablet layouts.

Key screens to generate:
1. Document upload and queue screen.
2. Active analysis progress screen with five agent statuses.
3. Review dashboard with aggregate risk score and clause heatmap.
4. Finding detail view with evidence quote, source chunk, page number, confidence, severity, and recommended revision.
5. Exportable report preview.

Primary users should immediately understand that this is a legal AI risk-review tool, not a generic chat app.
```

## Roadmap

- Phase 1: Project setup and Neon DB schemas
- Phase 2: Document ingestion, OCR, chunking, and Pinecone indexing
- Phase 3: Groq LLM multi-agent system and anti-hallucination guardrails
- Phase 4: Legal Synthesis Engine and legal risk scoring
- Phase 5: Express API gateway and orchestration
- Phase 6: End-to-end integration testing

