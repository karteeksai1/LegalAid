"""
Inference wrapper for Risk Scoring Engine (Model 2).
Loads trained GradientBoostingRegressor pipeline from services/ai/app/ml/models/risk_scoring_regressor.joblib.
Predicts calibrated 0–10 risk score from structured multi-agent outputs and extracts explainable risk drivers.
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
import joblib

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).resolve().parent / "models" / "risk_scoring_regressor.joblib"

_REGRESSOR_PAYLOAD = None


def get_risk_regressor_payload():
    """Singleton getter for the trained risk scoring regressor."""
    global _REGRESSOR_PAYLOAD
    if _REGRESSOR_PAYLOAD is None:
        if MODEL_PATH.exists():
            try:
                _REGRESSOR_PAYLOAD = joblib.load(MODEL_PATH)
                logger.info(f"Loaded trained Risk Scoring Regressor from {MODEL_PATH}")
            except Exception as e:
                logger.error(f"Failed to load risk scoring regressor from {MODEL_PATH}: {e}")
                _REGRESSOR_PAYLOAD = None
        else:
            logger.warning(f"Risk scoring regressor model file not found at {MODEL_PATH}")
    return _REGRESSOR_PAYLOAD


def get_risk_level_label(score: float) -> str:
    """Classifies risk score (1-10) into standardized tier."""
    if score >= 8.0:
        return "Critical"
    elif score >= 6.5:
        return "High"
    elif score >= 4.0:
        return "Medium"
    else:
        return "Low"


def predict_contract_risk(findings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Predicts final contract risk score (0-10) from structured multi-agent findings.
    Exposes explainable risk drivers derived from feature importances.
    """
    from scripts.ml.prepare_risk_data import extract_structured_risk_features

    if not findings:
        return {
            "aggregate_risk_score": 1.0,
            "risk_level": "Low",
            "model_type": "baseline",
            "risk_drivers": ["No adverse contractual findings or liabilities detected by the agent panel."],
            "features": {}
        }

    feats_dict = extract_structured_risk_features(findings)
    payload = get_risk_regressor_payload()

    if payload is not None:
        try:
            pipeline = payload["pipeline"]
            feature_names = payload["feature_names"]

            x_vec = np.array([[feats_dict.get(k, 0.0) for k in feature_names]], dtype=np.float32)
            raw_score = float(pipeline.predict(x_vec)[0])
            score = round(max(1.0, min(10.0, raw_score)), 1)
            level = get_risk_level_label(score)

            # Generate top explainable risk drivers based on feature importances and active features
            drivers = []
            regressor = pipeline.named_steps["regressor"]
            if hasattr(regressor, "feature_importances_"):
                importances = regressor.feature_importances_
                # Compute contribution score: feature_value * feature_importance
                contributions = []
                for i, name in enumerate(feature_names):
                    val = feats_dict.get(name, 0.0)
                    if val > 0:
                        contributions.append((name, val, importances[i], val * importances[i]))

                contributions.sort(key=lambda x: x[3], reverse=True)
                for name, val, imp, contr in contributions[:3]:
                    human_name = name.replace("_", " ").title()
                    drivers.append(f"{human_name} (active: {val:.1f}, importance: {imp*100:.1f}%)")

            if not drivers:
                drivers.append(f"Even distribution across {len(findings)} verified findings.")

            return {
                "aggregate_risk_score": score,
                "risk_level": level,
                "model_type": "classical_gradient_boosting",
                "risk_drivers": drivers,
                "features": feats_dict
            }
        except Exception as e:
            logger.error(f"Error during ML risk regression prediction: {e}")

    # Fallback to heuristic formula if model is unavailable
    crit = feats_dict.get("critical_count", 0.0)
    high = feats_dict.get("high_count", 0.0)
    med = feats_dict.get("medium_count", 0.0)
    low = feats_dict.get("low_count", 0.0)
    raw_score = 1.0 + (crit * 2.0) + (high * 1.2) + (med * 0.5) + (low * 0.1)
    score = round(min(10.0, max(1.0, raw_score)), 1)
    level = get_risk_level_label(score)

    return {
        "aggregate_risk_score": score,
        "risk_level": level,
        "model_type": "heuristic_fallback",
        "risk_drivers": [f"Critical findings: {int(crit)}", f"High findings: {int(high)}"],
        "features": feats_dict
    }
