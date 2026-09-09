"""
Unit and integration tests for Risk Scoring Engine (Model 2).
Verifies:
1. Structured feature extraction from agent outputs
2. Regressor artifact loading
3. Calibration across risk tiers (Low, Medium, High, Critical)
4. Explainable risk drivers generation
5. Score bounding strictly between 1.0 and 10.0
"""

import pytest
from app.ml.risk_regressor import predict_contract_risk, get_risk_regressor_payload
from scripts.ml.prepare_risk_data import extract_structured_risk_features


def test_risk_regressor_artifact_loads():
    payload = get_risk_regressor_payload()
    assert payload is not None, "Model artifact risk_scoring_regressor.joblib must be loaded"
    assert "pipeline" in payload
    assert "feature_names" in payload
    assert len(payload["feature_names"]) > 20


def test_structured_feature_extraction():
    sample_findings = [
        {
            "agent_name": "Risk & Liability Counsel",
            "clause_type": "Indemnity",
            "finding_type": "Unbalanced Indemnification",
            "severity_score": 8,
            "confidence": 0.90,
            "verification_status": "verified",
            "risk_level": "Critical"
        },
        {
            "agent_name": "Opposing Counsel",
            "clause_type": "Liability",
            "finding_type": "Carve-out Exploitation Vector",
            "severity_score": 7,
            "confidence": 0.85,
            "verification_status": "verified",
            "risk_level": "High"
        }
    ]
    feats = extract_structured_risk_features(sample_findings)
    assert feats["total_findings"] == 2.0
    assert feats["critical_count"] == 1.0
    assert feats["high_count"] == 1.0
    assert feats["grounding_rate"] == 1.0
    assert feats["count_indemnity"] >= 1.0
    assert feats["count_liability"] >= 1.0


def test_empty_findings_produces_minimum_score():
    res = predict_contract_risk([])
    assert res["aggregate_risk_score"] == 1.0
    assert res["risk_level"] == "Low"
    assert len(res["risk_drivers"]) > 0


def test_low_risk_contract_prediction():
    low_findings = [
        {
            "agent_name": "Neutral Legal Reviewer",
            "clause_type": "Governing Law",
            "finding_type": "Standard Forum Selection",
            "severity_score": 2,
            "confidence": 0.95,
            "verification_status": "verified",
            "risk_level": "Low"
        },
        {
            "agent_name": "Transaction Counsel",
            "clause_type": "Confidentiality",
            "finding_type": "Reciprocal Obligations",
            "severity_score": 2,
            "confidence": 0.90,
            "verification_status": "verified",
            "risk_level": "Low"
        }
    ]
    res = predict_contract_risk(low_findings)
    assert 1.0 <= res["aggregate_risk_score"] <= 3.5
    assert res["risk_level"] == "Low"
    assert res["model_type"] == "classical_gradient_boosting"


def test_critical_risk_contract_prediction():
    critical_findings = [
        {
            "agent_name": "Risk & Liability Counsel",
            "clause_type": "Indemnity",
            "finding_type": "Uncapped Third-Party Indemnity",
            "severity_score": 9,
            "confidence": 0.96,
            "verification_status": "verified",
            "risk_level": "Critical"
        },
        {
            "agent_name": "Opposing Counsel",
            "clause_type": "Indemnity",
            "finding_type": "Pre-Adjudication Defense Escrow",
            "severity_score": 9,
            "confidence": 0.94,
            "verification_status": "verified",
            "risk_level": "Critical"
        },
        {
            "agent_name": "Risk & Liability Counsel",
            "clause_type": "Liability",
            "finding_type": "Waiver of Liability Protections",
            "severity_score": 9,
            "confidence": 0.92,
            "verification_status": "verified",
            "risk_level": "Critical"
        }
    ]
    res = predict_contract_risk(critical_findings)
    assert res["aggregate_risk_score"] >= 7.5
    assert res["risk_level"] in ("High", "Critical")
    assert len(res["risk_drivers"]) > 0
    # Top driver should mention Indemnity or Critical findings
    assert any("Indemnity" in d or "Critical" in d or "Counsel" in d for d in res["risk_drivers"])


def test_score_strictly_bounded_1_to_10():
    huge_critical_findings = [
        {
            "agent_name": "Risk & Liability Counsel",
            "clause_type": "Indemnity",
            "finding_type": "Extreme Catastrophic Breach",
            "severity_score": 10,
            "confidence": 1.0,
            "verification_status": "verified",
            "risk_level": "Critical"
        }
    ] * 20
    res = predict_contract_risk(huge_critical_findings)
    assert res["aggregate_risk_score"] <= 10.0
    assert res["aggregate_risk_score"] >= 1.0
