# LegalAid Evaluation Suite (`evals/`)

This directory contains evaluation documents, benchmark contracts, and automated LLM-driven evaluations for the LegalAid multi-agent legal intelligence platform.

Findings, risk calculations, and consensus reports from evaluation runs are automatically stored in the **Neon PostgreSQL** database (`neondb`).

---

## Directory Structure

```
evals/
├── README.md                  # This file
├── sample-eval-contract.txt   # Sample commercial agreement for testing
├── run_evals.py               # Evaluation runner script (convenience wrapper)
└── results/                   # Timestamped evaluation reports (JSON summaries)
```

---

## Adding Evaluation Files

Place any contract files you wish to evaluate directly in this `evals/` directory or in subfolders:
- Supported formats: `.txt`, `.md`, `.pdf`
- You can add single agreements, NDAs, Master Service Agreements (MSAs), vendor terms, or adversarial contract templates.

---

## Running Evaluations

You can run evaluations using any of the following commands from the repository root:

```bash
# 1. Run all evaluation files found in evals/
pnpm evals

# Or directly with Python:
./services/ai/.venv/bin/python scripts/run_evals.py

# 2. Run on a specific file:
./services/ai/.venv/bin/python scripts/run_evals.py evals/sample-eval-contract.txt

# 3. Run on a custom directory:
./services/ai/.venv/bin/python scripts/run_evals.py path/to/my-contracts/
```

---

## What the Evaluation Pipeline Does

1. **Document Ingestion & Chunking**:
   - Reads the contract text and computes a SHA-256 fingerprint.
   - Splits the agreement into structured semantic chunks with page numbering and token counts.

2. **Multi-Agent Legal Evaluation (LLM via Groq)**:
   - Dispatches document chunks to specialist legal personas powered by `llama-3.3-70b-versatile`:
     - **Risk & Liability Counsel**: Uncapped exposures, indemnity pass-throughs, third-party liability.
     - **Opposing Counsel**: Adversarial attack vectors, termination traps, unilateral exploitation.
     - **Transaction Counsel**: Structural drafting flaws, ambiguities, missing transition terms.
     - **Neutral Legal Reviewer**: Enforceability standards, unconscionability, judicial balance.
     - **Regulatory & Compliance Counsel**: Privacy regulations (GDPR/CCPA), statutory alignment.

3. **Hard Grounding Verification**:
   - Every finding's `evidence_quote` is strictly verified against the verbatim source text. Ungrounded or hallucinated claims are discarded.

4. **Consensus Arbitration & Risk Scoring**:
   - Simulates multi-agent panel deliberation to assign calibrated severity scores (1–10) and calculate aggregate contract risk.

5. **Neon PostgreSQL Database Persistence**:
   - Inserts/updates the document in the `documents` table (`status="completed"`).
   - Inserts text chunks into the `chunks` table.
   - Inserts the overall analysis in `analysis_results` (scores, breakdown, consensus report).
   - Inserts every verified legal vulnerability into `agent_findings` with full audit metadata.
