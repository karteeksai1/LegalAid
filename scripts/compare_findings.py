#!/usr/bin/env python3
"""
LegalAid Benchmark Comparison Script
Compares system-generated findings against ground-truth findings (e.g. from ChatGPT)
and computes Precision, Recall, F1 Score, Groundedness %, and Severity MAE.
"""

import argparse
import io
import json
import logging
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# Setup root path
ROOT_DIR = Path(__file__).resolve().parent.parent
AI_DIR = ROOT_DIR / "services" / "ai"
if str(AI_DIR) not in sys.path:
    sys.path.insert(0, str(AI_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")
logger = logging.getLogger("compare_findings")

from app.services.analyzer import analyze_document_content

EVALS_DIR = ROOT_DIR / "evals"
TEST_DATA_DIR = EVALS_DIR / "test_data"
FINDINGS_DIR = EVALS_DIR / "findings"
RESULTS_DIR = EVALS_DIR / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
FINDINGS_DIR.mkdir(parents=True, exist_ok=True)


class SimpleChunk:
    """Lightweight Chunk wrapper to run analyzer without database dependency."""
    def __init__(self, raw_text: str, chunk_id: int):
        self.id = uuid.uuid4()
        self.chunk_id = chunk_id
        self.raw_text = raw_text


def extract_text_from_file(file_path: Path) -> str:
    """Extracts raw text from text or PDF files."""
    suffix = file_path.suffix.lower()
    content_bytes = file_path.read_bytes()

    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content_bytes))
            return "\n\n".join([page.extract_text() or "" for page in reader.pages]).strip()
        except Exception:
            return content_bytes.decode("latin1", errors="ignore")
    else:
        text = content_bytes.decode("utf-8", errors="replace")
        return re.sub(r'_{3,}', ' [BLANK_FIELD] ', text)


def chunk_text(text: str) -> List[SimpleChunk]:
    """Segments raw text into ~1500 char chunks."""
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_len = 0
    idx = 0

    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        char_count = len(p)
        if current_len + char_count > 1500 and current_chunk:
            chunks.append(SimpleChunk("\n\n".join(current_chunk), idx))
            idx += 1
            current_chunk = []
            current_len = 0
        current_chunk.append(p)
        current_len += char_count

    if current_chunk:
        chunks.append(SimpleChunk("\n\n".join(current_chunk), idx))

    if not chunks and text:
        chunks.append(SimpleChunk(text, 0))

    return chunks


def parse_json_safely(raw_str: str) -> Any:
    """Extracts JSON from text, handling markdown codeblocks or unescaped characters."""
    cleaned = raw_str.strip()
    # Strip markdown ```json ... ``` fences
    match = re.search(r'```(?:json)?\s*(.*?)\s*```', cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1).strip()
    
    # Try direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try fixing common issues like trailing commas
        sanitized = re.sub(r',\s*([\]}])', r'\1', cleaned)
        try:
            return json.loads(sanitized)
        except Exception as e:
            logger.error(f"Failed to parse JSON: {e}")
            return None


def normalize_clause_type(clause: str) -> Set[str]:
    """Extracts normalized clause tags from clause_type strings."""
    c = clause.lower().replace("&", " ").replace("/", " ").replace("-", " ")
    tokens = set(re.findall(r'\b[a-z]{3,}\b', c))
    
    canonical = set()
    if any(k in c for k in ["indemn", "hold harmless"]):
        canonical.add("indemnity")
    if any(k in c for k in ["liab", "damages", "cap", "carrier liability"]):
        canonical.add("liability")
    if any(k in c for k in ["terminat", "survival"]):
        canonical.add("termination")
    if any(k in c for k in ["confident", "non disclosure", "nda", "proprietary"]):
        canonical.add("confidentiality")
    if any(k in c for k in ["intellectual property", "ip", "patent", "copyright", "ownership"]):
        canonical.add("intellectual property")
    if any(k in c for k in ["govern", "jurisdiction", "dispute", "arbitrat", "court", "law"]):
        canonical.add("governing law")
    if any(k in c for k in ["restrict", "covenant", "compete", "solicit"]):
        canonical.add("restrictive covenants")
    if any(k in c for k in ["remed", "injunct", "equitable"]):
        canonical.add("remedies")
        
    return canonical or tokens


def token_jaccard_similarity(str1: str, str2: str) -> float:
    """Computes token Jaccard similarity between two text quotes."""
    words1 = set(re.findall(r'\b\w{3,}\b', str1.lower()))
    words2 = set(re.findall(r'\b\w{3,}\b', str2.lower()))
    if not words1 or not words2:
        return 0.0
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    return len(intersection) / len(union)


def verify_groundedness(evidence_quote: str, full_doc_text: str) -> bool:
    """Verifies whether the evidence quote appears verbatim or near-verbatim in doc text."""
    if not evidence_quote:
        return False
    q = re.sub(r'\s+', ' ', evidence_quote.strip()).lower()
    doc_norm = re.sub(r'\s+', ' ', full_doc_text).lower()

    if len(q) > 25 and (q in doc_norm or q[:25] in doc_norm or q[-25:] in doc_norm):
        return True
    
    # Check token containment
    tokens = [w for w in re.findall(r'\b\w{4,}\b', q) if w not in {"shall", "party", "agreement", "under"}]
    if len(tokens) >= 3:
        subphrase = " ".join(tokens[:3])
        if subphrase in doc_norm:
            return True

    return q in doc_norm


def load_ground_truth(test_files: List[Path]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Loads ground truth findings from evals/findings/.
    Supports:
    1. Exact filename match: evals/findings/<contract_name>.json
    2. Stem match: evals/findings/<stem>.json
    3. Master file: evals/findings/ground_truth.json (or any json) mapping filename -> findings
    4. Auto-route by evidence quote containment in contracts!
    """
    ground_truth_map: Dict[str, List[Dict[str, Any]]] = {f.name: [] for f in test_files}
    doc_text_map: Dict[str, str] = {f.name: extract_text_from_file(f) for f in test_files}

    if not FINDINGS_DIR.exists():
        return ground_truth_map

    finding_files = list(FINDINGS_DIR.glob("*.json")) + list(FINDINGS_DIR.glob("*.txt"))
    unrouted_findings: List[Dict[str, Any]] = []

    for fpath in finding_files:
        if fpath.name.lower() in {"readme.md"}:
            continue

        raw = fpath.read_text(encoding="utf-8", errors="replace")
        data = parse_json_safely(raw)
        if not data:
            continue

        # Check if direct match by filename
        direct_match = None
        for tf in test_files:
            if tf.stem.lower() in fpath.stem.lower() or fpath.stem.lower() in tf.stem.lower():
                direct_match = tf.name
                break

        if isinstance(data, list):
            if direct_match:
                ground_truth_map[direct_match].extend(data)
            else:
                unrouted_findings.extend(data)
        elif isinstance(data, dict):
            found_mapping = False
            for k, val in data.items():
                if isinstance(val, list):
                    for tf in test_files:
                        if tf.name.lower() in k.lower() or tf.stem.lower() in k.lower():
                            ground_truth_map[tf.name].extend(val)
                            found_mapping = True
                            break
            if not found_mapping:
                if "findings" in data and isinstance(data["findings"], list):
                    if direct_match:
                        ground_truth_map[direct_match].extend(data["findings"])
                    else:
                        unrouted_findings.extend(data["findings"])
                elif direct_match:
                    ground_truth_map[direct_match].append(data)
                else:
                    unrouted_findings.append(data)

    # Auto-route unrouted findings by matching quotes or summary mentions to contract texts
    for item in unrouted_findings:
        quote = item.get("evidence_quote", "")
        summary = item.get("summary", "")
        routed = False

        # First check if document filename mentioned in summary or fields
        for fname in doc_text_map.keys():
            stem_core = fname.split("_")[0]
            if (len(stem_core) > 4 and stem_core.lower() in summary.lower()) or stem_core.lower() in str(item).lower():
                ground_truth_map[fname].append(item)
                routed = True
                break

        if not routed and quote:
            # Match by quote appearing in contract text
            for fname, dtext in doc_text_map.items():
                q_clean = quote.strip().lower()
                d_clean = dtext.lower()
                if q_clean[:40] in d_clean:
                    ground_truth_map[fname].append(item)
                    routed = True
                    break

        if not routed and len(test_files) == 1:
            ground_truth_map[test_files[0].name].append(item)

    return ground_truth_map


def match_findings(
    predictions: List[Dict[str, Any]],
    ground_truth: List[Dict[str, Any]],
    doc_text: str
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Matches predictions against ground truth using greedy bipartite matching."""
    matched_gt_indices: Set[int] = set()
    matched_pred_indices: Set[int] = set()
    tp_pairs = []

    candidates = []
    for p_idx, p in enumerate(predictions):
        p_clause = normalize_clause_type(p.get("clause_type", ""))
        p_quote = p.get("evidence_quote", "")

        for g_idx, g in enumerate(ground_truth):
            g_clause = normalize_clause_type(g.get("clause_type", ""))
            g_quote = g.get("evidence_quote", "")

            clause_overlap = len(p_clause.intersection(g_clause)) > 0
            quote_sim = token_jaccard_similarity(p_quote, g_quote)
            exact_sub = (p_quote in g_quote) or (g_quote in p_quote) if p_quote and g_quote else False

            match_score = 0.0
            if clause_overlap:
                match_score += 0.5
            if exact_sub:
                match_score += 0.5
            else:
                match_score += (quote_sim * 0.5)

            if (clause_overlap and (quote_sim >= 0.08 or exact_sub or not g_quote)) or quote_sim >= 0.20:
                candidates.append((match_score, p_idx, g_idx, quote_sim))

    candidates.sort(key=lambda x: x[0], reverse=True)

    for score, p_idx, g_idx, q_sim in candidates:
        if p_idx not in matched_pred_indices and g_idx not in matched_gt_indices:
            matched_pred_indices.add(p_idx)
            matched_gt_indices.add(g_idx)
            tp_pairs.append({
                "predicted": predictions[p_idx],
                "ground_truth": ground_truth[g_idx],
                "quote_similarity": q_sim,
                "score_diff": abs(int(predictions[p_idx].get("severity_score", 5)) - int(ground_truth[g_idx].get("severity_score", 5)))
            })

    fp = [predictions[i] for i in range(len(predictions)) if i not in matched_pred_indices]
    fn = [ground_truth[i] for i in range(len(ground_truth)) if i not in matched_gt_indices]

    return tp_pairs, fp, fn


def evaluate_document(
    file_path: Path,
    ground_truth: List[Dict[str, Any]],
    precomputed_findings: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Runs evaluation for a single document against its ground truth."""
    doc_text = extract_text_from_file(file_path)

    # Get predictions
    if precomputed_findings is not None:
        predictions = precomputed_findings
    else:
        chunks = chunk_text(doc_text)
        analysis = analyze_document_content(chunks)
        predictions = analysis.get("findings", [])

    # Check Groundedness
    pred_grounded_count = sum(1 for p in predictions if verify_groundedness(p.get("evidence_quote", ""), doc_text))
    pred_groundedness_rate = (pred_grounded_count / len(predictions)) if predictions else 1.0

    gt_grounded_count = sum(1 for g in ground_truth if verify_groundedness(g.get("evidence_quote", ""), doc_text))
    gt_groundedness_rate = (gt_grounded_count / len(ground_truth)) if ground_truth else 1.0

    # Match Findings
    tp_pairs, fp, fn = match_findings(predictions, ground_truth, doc_text)

    tp_count = len(tp_pairs)
    fp_count = len(fp)
    fn_count = len(fn)

    # Precision, Recall, F1
    precision = tp_count / (tp_count + fp_count) if (tp_count + fp_count) > 0 else 0.0
    recall = tp_count / (tp_count + fn_count) if (tp_count + fn_count) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    severity_mae = sum(p["score_diff"] for p in tp_pairs) / tp_count if tp_count > 0 else 0.0
    avg_quote_overlap = sum(p["quote_similarity"] for p in tp_pairs) / tp_count if tp_count > 0 else 0.0

    return {
        "filename": file_path.name,
        "predictions_count": len(predictions),
        "ground_truth_count": len(ground_truth),
        "true_positives": tp_count,
        "false_positives": fp_count,
        "false_negatives": fn_count,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "groundedness_rate": round(pred_groundedness_rate * 100, 1),
        "gt_groundedness_rate": round(gt_groundedness_rate * 100, 1),
        "avg_quote_overlap": round(avg_quote_overlap, 3),
        "severity_mae": round(severity_mae, 2),
        "matched_pairs": tp_pairs,
        "false_positive_findings": fp,
        "false_negative_findings": fn
    }


def main():
    parser = argparse.ArgumentParser(description="LegalAid Benchmark Evaluation & Groundedness Comparison")
    parser.add_argument("target", nargs="?", default=None, help="Optional specific file or folder inside test_data to evaluate.")
    parser.add_argument("--eval-results", dest="eval_results", default=None, help="Path to past eval JSON run results.")
    args = parser.parse_args()

    print("=" * 92)
    print("  ⚖️   LegalAid Benchmark Comparison: System Findings vs. Ground Truth (ChatGPT)")
    print("=" * 92)

    target_path = Path(args.target).resolve() if args.target else TEST_DATA_DIR
    if target_path.is_file():
        test_files = [target_path]
    else:
        test_files = sorted([f for f in target_path.rglob("*") if f.is_file() and f.suffix.lower() in {".txt", ".md", ".pdf"}])

    if not test_files:
        print(f"❌ No test contracts found in: {target_path}")
        sys.exit(1)

    print(f"📂 Test Data Directory : {target_path}")
    print(f"📂 Findings Directory  : {FINDINGS_DIR}")
    gt_map = load_ground_truth(test_files)

    precomputed_map: Dict[str, List[Dict[str, Any]]] = {}
    if args.eval_results:
        eval_path = Path(args.eval_results)
        if eval_path.exists():
            print(f"📊 Loading pre-computed predictions from: {eval_path.name}")
            eval_data = json.loads(eval_path.read_text())
            for item in eval_data.get("results", []):
                fname = item.get("filename")
                if fname:
                    precomputed_map[fname] = item.get("findings", [])

    results = []
    print(f"📄 Processing {len(test_files)} document(s)...\n")

    for tf in test_files:
        gt_findings = gt_map.get(tf.name, [])
        pred_findings = precomputed_map.get(tf.name)
        res = evaluate_document(tf, gt_findings, pred_findings)
        results.append(res)

    # Print Formatted Results Table
    print("┌" + "─" * 90 + "┐")
    print(f"│ {'CONTRACT / DOCUMENT':<34} │ {'PRED':<5} │ {'GT':<4} │ {'PREC':<6} │ {'REC':<6} │ {'F1':<6} │ {'GROUNDED':<9} │")
    print("├" + "─" * 90 + "┤")

    total_pred = 0
    total_gt = 0
    total_tp = 0
    total_fp = 0
    total_fn = 0
    total_grounded_pred = 0

    for r in results:
        total_pred += r["predictions_count"]
        total_gt += r["ground_truth_count"]
        total_tp += r["true_positives"]
        total_fp += r["false_positives"]
        total_fn += r["false_negatives"]
        total_grounded_pred += (r["groundedness_rate"] / 100.0) * r["predictions_count"]

        name_abbr = (r["filename"][:32] + "..") if len(r["filename"]) > 34 else r["filename"]
        prec_str = f"{r['precision']:.2f}" if r["ground_truth_count"] > 0 else "N/A"
        rec_str = f"{r['recall']:.2f}" if r["ground_truth_count"] > 0 else "N/A"
        f1_str = f"{r['f1_score']:.2f}" if r["ground_truth_count"] > 0 else "N/A"
        grounded_str = f"{r['groundedness_rate']:.1f}%"

        print(f"│ {name_abbr:<34} │ {r['predictions_count']:<5} │ {r['ground_truth_count']:<4} │ {prec_str:<6} │ {rec_str:<6} │ {f1_str:<6} │ {grounded_str:<9} │")

    print("├" + "─" * 90 + "┤")

    overall_prec = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    overall_rec = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
    overall_f1 = (2 * overall_prec * overall_rec / (overall_prec + overall_rec)) if (overall_prec + overall_rec) > 0 else 0.0
    overall_groundedness = (total_grounded_pred / total_pred * 100) if total_pred > 0 else 100.0

    print(f"│ {'OVERALL BENCHMARK':<34} │ {total_pred:<5} │ {total_gt:<4} │ {overall_prec:.2f}   │ {overall_rec:.2f}   │ {overall_f1:.2f}   │ {overall_groundedness:.1f}%    │")
    print("└" + "─" * 90 + "┘\n")

    print("📈 Benchmark Metrics Summary:")
    print(f"   • Total System Findings  : {total_pred}")
    print(f"   • Total Ground Truth     : {total_gt}")
    print(f"   • True Positives (TP)    : {total_tp}")
    print(f"   • False Positives (FP)   : {total_fp}")
    print(f"   • False Negatives (FN)   : {total_fn}")
    print(f"   • Precision              : {overall_prec:.4f} ({overall_prec*100:.1f}%)")
    print(f"   • Recall                 : {overall_rec:.4f} ({overall_rec*100:.1f}%)")
    print(f"   • F1 Score               : {overall_f1:.4f}")
    print(f"   • Document Groundedness  : {overall_groundedness:.1f}% (verbatim quote authenticity)")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report_file = RESULTS_DIR / f"comparison_report_{timestamp}.json"
    latest_report_file = RESULTS_DIR / "comparison_latest.json"

    summary_payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall": {
            "total_documents": len(results),
            "total_predictions": total_pred,
            "total_ground_truth": total_gt,
            "true_positives": total_tp,
            "false_positives": total_fp,
            "false_negatives": total_fn,
            "precision": round(overall_prec, 4),
            "recall": round(overall_rec, 4),
            "f1_score": round(overall_f1, 4),
            "groundedness_rate": round(overall_groundedness, 2)
        },
        "documents": results
    }

    report_file.write_text(json.dumps(summary_payload, indent=2, default=str), encoding="utf-8")
    latest_report_file.write_text(json.dumps(summary_payload, indent=2, default=str), encoding="utf-8")
    print(f"\n💾 Full JSON report written to:")
    print(f"   {report_file}")
    print("=" * 92 + "\n")


if __name__ == "__main__":
    main()
