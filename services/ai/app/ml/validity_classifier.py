"""
Inference wrapper for Legal Document Validity Classifier (Model 1).
Loads trained classical ML pipeline from services/ai/app/ml/models/validity_classifier.joblib.
Provides calibrated 3-tier probability decision gating:
- P >= 0.60: Valid legal contract
- 0.40 <= P < 0.60: Borderline / uncertain (allows review with soft informational warning)
- P < 0.40: Rejected non-legal document
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import joblib

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).resolve().parent / "models" / "validity_classifier.joblib"

_CLASSIFIER_INSTANCE = None


def get_validity_classifier():
    """Singleton getter for the trained validity classifier."""
    global _CLASSIFIER_INSTANCE
    if _CLASSIFIER_INSTANCE is None:
        if MODEL_PATH.exists():
            try:
                _CLASSIFIER_INSTANCE = joblib.load(MODEL_PATH)
                logger.info(f"Loaded trained Legal Document Validity Classifier from {MODEL_PATH}")
            except Exception as e:
                logger.error(f"Failed to load validity classifier from {MODEL_PATH}: {e}")
                _CLASSIFIER_INSTANCE = None
        else:
            logger.warning(f"Validity classifier model file not found at {MODEL_PATH}")
    return _CLASSIFIER_INSTANCE


def classify_document_validity(
    text: str,
    filename: str = "",
    page_count: int = 1
) -> Dict[str, Any]:
    """
    Classifies whether document text represents a genuine legal contract or template.
    Returns:
        {
            "is_legal_contract": bool,
            "confidence": float,
            "status": "valid" | "borderline" | "rejected_non_contract" | "extraction_failed",
            "message": str,
            "rejection_reason": Optional[str],
            "model_type": "classical_ml" | "heuristic_fallback"
        }
    """
    if not text:
        return {
            "is_legal_contract": False,
            "confidence": 0.0,
            "status": "rejected_non_contract",
            "message": "No readable text extracted from document.",
            "rejection_reason": "Empty document text.",
            "model_type": "rule"
        }

    # 1. OCR / Extraction failure sanity check:
    # A multi-page document with virtually zero words is an extraction failure, not a legal verdict
    words = text.split()
    if page_count >= 2 and len(words) < 35:
        return {
            "is_legal_contract": False,
            "confidence": 0.0,
            "status": "extraction_failed",
            "message": f"We couldn't read this document properly ({page_count} pages detected, only {len(words)} words extracted). Try re-uploading or use a text-based PDF.",
            "rejection_reason": "Low word count for multi-page document.",
            "model_type": "rule"
        }

    # 2. Minimum length check: Under 25 words cannot be a legally binding contract
    if len(words) < 25:
        return {
            "is_legal_contract": False,
            "confidence": 0.01,
            "status": "rejected_non_contract",
            "message": f"Document text is too brief to constitute a legal contract ({len(words)} words).",
            "rejection_reason": "Text length below minimal legal threshold.",
            "model_type": "rule"
        }

    # 3. Model Inference
    clf = get_validity_classifier()
    if clf is not None:
        try:
            prob = float(clf.predict_proba([text])[0, 1])

            if prob >= 0.60:
                return {
                    "is_legal_contract": True,
                    "confidence": round(prob, 4),
                    "status": "valid",
                    "message": "Document verified as a legal agreement.",
                    "rejection_reason": None,
                    "model_type": "classical_ml"
                }
            elif prob >= 0.40:
                return {
                    "is_legal_contract": True,
                    "confidence": round(prob, 4),
                    "status": "borderline",
                    "message": "This document exhibits partial legal characteristics (e.g., standard template or preliminary draft). Proceeding with baseline legal analysis.",
                    "rejection_reason": None,
                    "model_type": "classical_ml"
                }
            else:
                return {
                    "is_legal_contract": False,
                    "confidence": round(prob, 4),
                    "status": "rejected_non_contract",
                    "message": f"This document does not appear to be a legal agreement (validity confidence: {prob*100:.1f}%). No enforceable contractual obligations or clauses were detected.",
                    "rejection_reason": f"Classical ML classifier assigned low legal probability ({prob*100:.1f}%).",
                    "model_type": "classical_ml"
                }
        except Exception as e:
            logger.error(f"Error during classical ML validity classification: {e}")

    # 4. Heuristic Fallback (only if model file is missing or failed to predict)
    from app.services.analyzer import is_contractual_document_heuristic
    is_leg, reason, fmode = is_contractual_document_heuristic(text, filename, page_count)
    return {
        "is_legal_contract": is_leg,
        "confidence": 0.85 if is_leg else 0.15,
        "status": "valid" if is_leg else ("extraction_failed" if fmode == "extraction_failed" else "rejected_non_contract"),
        "message": reason,
        "rejection_reason": reason if not is_leg else None,
        "model_type": "heuristic_fallback"
    }
