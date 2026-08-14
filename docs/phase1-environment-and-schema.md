# Phase 1 Environment And Database Schema

## Monorepo Layout

```text
apps/
  web/
  backend/
services/
  ai/
packages/
  shared/
infra/
  docker/
  neon/
docs/
```

- `apps/web`: React/Vite user interface for uploads, review dashboards, and downloadable reports.
- `apps/backend`: Express.js API backend for authentication, upload orchestration, queues, and AI service aggregation.
- `services/ai`: FastAPI microservice for OCR, chunking, Pinecone indexing, Groq multi-agent reasoning, and consensus scoring.
- `packages/shared`: Shared TypeScript constants and schemas used by web and backend.
- `infra`: Deployment, database, and local development infrastructure.

## Environment

Use `.env.example` as the template for local and deployed environments.

Required Phase 1 values:

- `DATABASE_URL`: Neon PostgreSQL URL for the FastAPI service, using the SQLAlchemy psycopg driver and `sslmode=require`.
- `GATEWAY_DATABASE_URL`: Neon PostgreSQL URL for the Express gateway.
- `JWT_SECRET`: Gateway signing secret with at least 16 characters.

AI and retrieval values reserved for later phases:

- `GROQ_API_KEY`: Groq API key.
- `GROQ_MODEL`: Defaults to `openai/gpt-oss-120b`.
- `PINECONE_API_KEY`: Pinecone API key.
- `PINECONE_INDEX_NAME`: Defaults to `legal-aid-documents`.

## Tables

### users

- `id`: UUID primary key.
- `email`: Unique indexed email address.
- `password_hash`: Password hash owned by the gateway auth layer.
- `role`: User role, default `reviewer`.
- `created_at`: Creation timestamp.
- `updated_at`: Update timestamp.

### documents

- `id`: UUID primary key.
- `owner_id`: Foreign key to `users.id`.
- `filename`: Original uploaded filename.
- `content_type`: Validated MIME type.
- `storage_uri`: Durable object storage URI.
- `sha256`: Unique document content hash.
- `status`: Processing status, default `uploaded`.
- `page_count`: Extracted page count.
- `metadata_json`: Extensible JSONB metadata.
- `created_at`: Creation timestamp.
- `updated_at`: Update timestamp.

### chunks

- `id`: UUID primary key.
- `document_id`: Foreign key to `documents.id`.
- `chunk_id`: Incremental per-document chunk identifier.
- `page_number`: Source page number.
- `clause_type`: Legal clause classification.
- `party_scope`: Plaintiff, Defendant, Mutual, or Unspecified.
- `raw_text`: Raw chunk content for deterministic reconstruction.
- `token_count`: Token count for the chunk.
- `pinecone_vector_id`: Linked Pinecone vector identifier.
- `created_at`: Creation timestamp.

### analysis_results

- `id`: UUID primary key.
- `document_id`: Foreign key to `documents.id`.
- `aggregate_risk_score`: Consolidated document risk score.
- `risk_level`: Critical, High, Medium, or Low.
- `critical_count`: Critical finding count.
- `high_count`: High finding count.
- `medium_count`: Medium finding count.
- `low_count`: Low finding count.
- `consensus_report`: Structured JSONB report payload.
- `created_at`: Creation timestamp.

### agent_findings

- `id`: UUID primary key.
- `analysis_result_id`: Foreign key to `analysis_results.id`.
- `chunk_id`: Nullable foreign key to `chunks.id`.
- `agent_name`: Defense Counsel, Drafting Counsel, Judge, Compliance, or Citation Evidence.
- `clause_type`: Clause category assessed by the agent.
- `finding_type`: Vulnerability, compliance issue, drafting issue, citation issue, or validation result.
- `summary`: Grounded structured finding summary.
- `evidence_quote`: Exact source evidence quote or `VERIFICATION_UNAVAILABLE`.
- `verification_status`: Verification state.
- `severity_score`: Integer severity from 1 to 10.
- `confidence`: Confidence from 0.000 to 1.000.
- `risk_level`: Critical, High, Medium, or Low.
- `structured_payload`: Raw validated agent output.
- `created_at`: Creation timestamp.
