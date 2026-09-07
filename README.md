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

```mermaid
flowchart TB
    subgraph UI["Client / Presentation Layer (React + Vite)"]
        User["User / Legal Reviewer"]
        subgraph Views["Dashboard & Views"]
            SimpleView["Simple Mode (Plain English Advisor)"]
            StdView["Standard Mode (5-Agent Legal Review)"]
            ChatUI["Interactive Q&A Chat (Synonym-aware)"]
            FindingsUI["Clause Heatmap & Evidence Drawer"]
        end
    end

    subgraph Gateway["API Gateway & Orchestration (Express.js / Node.js)"]
        Auth["Auth & Session Management"]
        UploadHandler["Multipart Upload & Validation"]
        JobRouter["Task Orchestrator & Proxy"]
    end

    subgraph AIService["AI Microservice (FastAPI + Python 3.11)"]
        subgraph Ingestion["Ingestion & Document Guardrails"]
            Parser["Text Extractor (PyMuPDF / OCR)"]
            DocClassifier["Pre-Flight Contract Classifier<br/>(Validates Legal vs Non-Legal / Templates)"]
            Chunker["Legal Semantic Chunker<br/>(Clauses, Parties, Pages)"]
        end

        subgraph Guardrails["Security & Intent Gateway"]
            SecFilter["Security Filter<br/>(Injection & Citation Fabrication Guardrails)"]
            IntentRouter["Intent Classifier & Synonym Expander<br/>(Layperson queries & Outcome predictions)"]
        end

        subgraph Agents["Multi-Agent Specialist Review Panel"]
            RLC["Risk & Liability Counsel<br/>(Liabilities & Unfavorable Terms)"]
            OC["Opposing Counsel<br/>(Adversarial Stress-Testing)"]
            TC["Transaction Counsel<br/>(Drafting Quality & Vagueness)"]
            NLR["Neutral Legal Reviewer<br/>(Enforceability & Precedent)"]
            RCC["Regulatory & Compliance Counsel<br/>(Statutory Rules & Compliance)"]
            LECR["Legal Evidence & Citation Reviewer<br/>(Source Text Verification)"]
        end

        subgraph Synthesis["Consensus & Synthesis Engine"]
            Arbiter["Legal Synthesis Engine<br/>(Deliberation Arbitration & Scoring)"]
            RAGEngine["RAG Q&A Engine<br/>(Groq LLM / Rule Fallback)"]
        end
    end

    subgraph Data["Persistence & Vector Layer"]
        Postgres[("Neon PostgreSQL<br/>Users, Docs, Chunks, Findings, Chats")]
        Pinecone[("Pinecone Vector DB<br/>Dense Semantic Embeddings")]
    end

    User -->|Upload Document / Ask Questions| Views
    Views --> Auth
    Auth --> UploadHandler
    UploadHandler --> JobRouter

    JobRouter --> Parser
    Parser --> DocClassifier
    DocClassifier -->|Valid Contract| Chunker
    DocClassifier -.->|Rejected / Non-Legal| Views
    Chunker --> Postgres
    Chunker --> Pinecone

    Chunker --> Agents
    Agents --> Arbiter
    Arbiter --> Postgres
    Arbiter --> Views

    ChatUI --> SecFilter
    SecFilter --> IntentRouter
    IntentRouter --> RAGEngine
    RAGEngine --> Pinecone
    RAGEngine --> Postgres
    RAGEngine --> ChatUI
```

### Architectural Highlights

1. **Dual-Mode Presentation Layer**:
   - **Simple Mode**: Renders legal risk through non-lawyer plain English explanations, actionable recommendations, and plain arbitration summaries.
   - **Standard Mode**: Full legal practitioner audit trail, displaying clause severity scores (1–10), multi-agent consensus deliberations, adversarial attack vectors, and verbatim evidence snippets.
   - **Interactive Q&A Engine**: Real-time RAG-powered chat supporting everyday layperson vocabulary (synonym expansion for terms like *"cancel on me"*, *"drop me"*, *"mess up"*), tailored court litigation prediction refusals, and anti-hallucination guardrails.

2. **API Gateway & Orchestration (Express.js)**:
   - Manages JWT authentication, persistent document lifecycles, and resilient client fallbacks.
   - Streams requests to the AI microservice while maintaining a local cache and optimistic state sync.

3. **AI Microservice & Multi-Agent Engine (FastAPI)**:
   - **Pre-Flight Contract Classifier**: Distinguishes binding legal contracts from non-legal documents (e.g. personal IDs, receipts) and safely accepts contract templates with blank fields (e.g. NDAs).
   - **Specialist Multi-Agent Review Panel**: Six distinct agent personas analyze the document in parallel across adversarial, transaction structure, regulatory, liability, and citation-checking dimensions.
   - **Legal Synthesis Engine**: Merges competing findings into an evidence-backed final consensus report with deterministic 0–100 risk scoring.
   - **Strict Security Guardrails**: Proactively detects and intercepts prompt injection attempts and demands for fabricated case law citations before queries reach the LLM.

4. **Persistence & Vector Layer**:
   - **Neon PostgreSQL**: Stores user credentials, document metadata, extracted chunks, agent findings, and full conversation trajectories.
   - **Pinecone Vector Database**: Indexes chunk embeddings with deterministic metadata for high-precision semantic retrieval.

## Current Status

Phase 1 scaffold is in place:

- Monorepo layout
- React/Vite web app shell
- Express/TypeScript backend shell
- FastAPI AI service shell
- SQLAlchemy schema models for Neon PostgreSQL
- Shared TypeScript package
- Environment template
- Phase 1 schema documentation
- Groq model config defaulting to `openai/gpt-oss-120b`

Later phases will add document ingestion, OCR, Pinecone indexing, Groq multi-agent execution, consensus scoring, upload orchestration, and integration tests.

## Monorepo Structure

```text
LegalAid/
  apps/
    web/                 React + Vite user interface
    backend/             Express.js API backend and orchestration layer
  services/
    ai/                  FastAPI AI microservice
  packages/
    shared/              Shared TypeScript constants and schemas
  infra/
    docker/              Future local Docker/dev infrastructure
    neon/                Future database migration and provisioning notes
  docs/
    phase1-environment-and-schema.md
  .env.example
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

## Tech Stack

- Web: React, Vite, TypeScript, lucide-react
- Backend: Express.js, TypeScript, Zod
- AI microservice: FastAPI, Python 3.11+, SQLAlchemy, Pydantic Settings
- LLM provider: Groq API
- Default Groq model: `openai/gpt-oss-120b`
- Database: Neon PostgreSQL
- Vector database: Pinecone
- OCR pipeline: Tesseract, pytesseract, pdf2image

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

