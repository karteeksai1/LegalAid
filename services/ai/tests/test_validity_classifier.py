"""
Unit and integration tests for Legal Document Validity Classifier (Model 1).
Verifies:
1. LegalDocumentFeatureExtractor output shape and feature semantics
2. Serialized classical ML model loads correctly
3. High confidence acceptance of standard contracts (P >= 0.60)
4. Definite acceptance of unsigned contract templates (SPMCIL NDA template)
5. Definite rejection of non-legal files (ID cards, resumes, invoices) (P < 0.40)
6. Extraction failure detection on corrupt multi-page documents
"""

import pytest
from app.ml.feature_extractor import LegalDocumentFeatureExtractor
from app.ml.validity_classifier import classify_document_validity, get_validity_classifier


def test_feature_extractor_dimensions_and_types():
    extractor = LegalDocumentFeatureExtractor()
    sample_text = "This Agreement is made by and between Company A and Company B. 1. Section One. Vendor shall indemnify Buyer."
    feats = extractor.transform([sample_text])
    assert feats.shape == (1, len(LegalDocumentFeatureExtractor.FEATURE_NAMES))
    assert feats[0, 0] > 0  # legal_keyword_count


def test_model_artifact_is_loaded():
    clf = get_validity_classifier()
    assert clf is not None, "Model artifact validity_classifier.joblib must be loaded"


def test_spmcil_nda_template_acceptance():
    """Critical test case: SPMCIL NDA template with blank fields must NOT be rejected!"""
    template_text = """
    SECURITY PRINTING AND MINTING CORPORATION OF INDIA LIMITED (SPMCIL)
    NON-DISCLOSURE AGREEMENT (NDA)
    This Non-Disclosure Agreement is made and entered into on this _____ day of ____________, 202___ by and between:
    Security Printing and Minting Corporation of India Limited (hereinafter referred to as "SPMCIL") of the FIRST PART;
    AND
    M/s ________________________________________ (hereinafter referred to as the "Bidder/Contractor") of the SECOND PART.
    WHEREAS:
    A. SPMCIL has floated Tender No. ______________________ for the procurement of security currency paper.
    1. DEFINITIONS: "Confidential Information" means all technical and financial terms disclosed.
    2. OBLIGATIONS: The Receiving Party shall hold all Confidential Information in strict confidence.
    3. GOVERNING LAW: This Agreement shall be governed by the laws of the Republic of India.
    IN WITNESS WHEREOF, the parties have executed this Agreement by their authorized signatories.
    Signature: ___________________________
    Name: _______________________________
    Title: Authorized Signatory
    """
    res = classify_document_validity(template_text, filename="SPMCIL_NDA_Template.pdf", page_count=2)
    assert res["is_legal_contract"] is True
    assert res["confidence"] >= 0.60
    assert res["status"] in ("valid", "borderline")
    assert res["model_type"] == "classical_ml"


def test_id_card_rejection():
    """Critical test case: ID card must be rejected by classical ML model."""
    id_card_text = """
    STATE DEPARTMENT OF MOTOR VEHICLES
    DRIVER LICENSE
    DL NO: D88392014 CLASS: C EXP: 11/14/2028
    NAME: ROBERT ANTHONY VANCE
    ADDRESS: 1420 PINE CREST RD, AUSTIN, TX 78704
    DOB: 05/22/1990 SEX: M EYES: BRN HT: 5-11
    ORGAN DONOR: YES
    [PHOTO] [2D BARCODE]
    """
    res = classify_document_validity(id_card_text, filename="government_id_card.png", page_count=1)
    assert res["is_legal_contract"] is False
    assert res["confidence"] < 0.40
    assert res["status"] == "rejected_non_contract"


def test_resume_rejection():
    """Critical test case: Resumes must be rejected."""
    resume_text = """
    ALEXANDER CHEN | Software Engineer
    alex.chen@email.com | github.com/alexchen
    PROFESSIONAL SUMMARY: Senior Software Engineer with 6+ years experience in Python, Go, Docker, PostgreSQL.
    WORK EXPERIENCE:
    Senior Backend Engineer | CloudScale Systems | 2021 - Present
    Architected event-driven ingestion pipeline handling 50M daily events with Kafka and FastAPI.
    EDUCATION: BS Computer Science, UC Berkeley.
    SKILLS: Python, Go, TypeScript, PostgreSQL, Redis, Kubernetes, AWS.
    """
    res = classify_document_validity(resume_text, filename="alex_chen_resume.pdf", page_count=1)
    assert res["is_legal_contract"] is False
    assert res["confidence"] < 0.40
    assert res["status"] == "rejected_non_contract"


def test_commercial_agreement_acceptance():
    """Real commercial contract must be accepted with high probability."""
    contract_text = """
    MASTER SERVICES AGREEMENT
    This Master Services Agreement ("Agreement") is made effective as of January 1, 2024, by and between
    Acme Software Inc. ("Provider") and Global Logistics Corp. ("Client").
    1. SERVICES: Provider shall perform the services described in executed Statements of Work.
    2. INDEMNIFICATION: Provider shall indemnify, defend, and hold harmless Client from third-party IP claims.
    3. LIMITATION OF LIABILITY: Neither party's aggregate liability under this Agreement shall exceed fees paid in prior 12 months.
    4. TERMINATION: Either party may terminate for convenience upon sixty (60) days prior written notice.
    5. GOVERNING LAW: This Agreement shall be governed by the laws of the State of Delaware.
    IN WITNESS WHEREOF, the parties have executed this Agreement by their authorized representatives.
    By: Jane Doe, Chief Executive Officer
    By: John Smith, VP Procurement
    """
    res = classify_document_validity(contract_text, filename="master_services_agreement.pdf", page_count=3)
    assert res["is_legal_contract"] is True
    assert res["confidence"] >= 0.85
    assert res["status"] == "valid"


def test_extraction_failure_detection():
    """Multi-page document with virtually zero extracted words must report extraction_failed."""
    corrupt_text = "Page 1 of 5 \n Copyright 2024"
    res = classify_document_validity(corrupt_text, filename="scanned_corrupt.pdf", page_count=5)
    assert res["is_legal_contract"] is False
    assert res["status"] == "extraction_failed"
