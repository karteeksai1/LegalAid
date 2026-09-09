import uuid
import pytest
from app.models import Chunk
from app.services.analyzer import (
    analyze_document_content,
    validate_evidence_grounding,
    deduplicate_findings,
    is_contractual_document,
)

ZTO_CONTRACT_TEXT = """
Exhibit 10.10   Road Transportation Agreement   Party A (Shipper): ZTO Express Co., Ltd. Address: Building 1, No. 1685, Huazhi Road, Huaxin Twon, Qingpu District, Shanghai   Party B (Carrier): Tonglu Tongze Logistics Ltd. Address: 12 Floor, HSBC Tower, Yinchun South Road, Tonglu County, Zhejiang Province   Due to the need for logistics business, Party A and Party B enter into this Road Transportation Agreement (this "Agreement"), in which Party A pays the freight and Party B provides parcel transportation services to Party A. In accordance with relevant laws and regulations, Party A and Party B have sufficiently negotiated the specific matters and voluntarily reached the following Agreement based on equality, reciprocity and integrity. This Agreement is to be complied by both Parties.   1. Party B shall provide parcel transportation services on highway line-haul routes based on the needs of Party A.   2. Period of transportation services: this Agreement is valid for an indefinite term. Subsequent contracts might be entered in case of special business.   3. Freight and payment method:   (a) Verification of freight: Party A pays freight based on carload rate (such freight includes pick-up charges, door-to-door delivery charges and tax fees).   (b) Party A shall not pay any other charges other than the freight.   (c) Clearance of freight: the clearance method is based on both Parties' fund clearance arrangement and the final clearance amount is subject to actual carriage amount and EX-warehouse ("EXW") weight determined by Party A. Party B shall attach Party A's parcel EXW originals or copies for Party A's verification for clearance of freight.   4. Transportation route, time and relevant rules   (a) Transportation time:   (b) Any changes to the line-haul route and time are subject to both Parties' negotiation and written supplemental clauses.   (c) Party B shall have its own loading crews and the parcel shall be loaded by Party B's loading crews.
"""

def test_classifier_identifies_zto_as_valid_contract():
    is_contract, reason, failure_mode = is_contractual_document(
        ZTO_CONTRACT_TEXT, filename="ZTO_Road_Transportation_Agreement.txt", page_count=1
    )
    assert is_contract is True
    assert failure_mode == "valid"

def test_evidence_grounding_rejects_hallucinated_indemnity():
    # An agent hallucinating indemnity on a freight clearance quote
    fake_indemnity_finding = {
        "finding_type": "One-Sided Lawsuit & Legal Fee Trap",
        "clause_type": "Indemnity",
        "summary": "You are promising to pay the other party's legal bills and damages for third-party disputes with no limit.",
        "evidence_quote": "Party A pays freight based on carload rate (such freight includes pick-up charges, door-to-door delivery charges and tax fees).",
        "severity_score": 8,
    }
    is_valid, reason = validate_evidence_grounding(fake_indemnity_finding, ZTO_CONTRACT_TEXT)
    assert is_valid is False
    assert "indemnity" in reason.lower() or "fee" in reason.lower()

def test_evidence_grounding_rejects_hallucinated_vague_deliverables():
    # An agent asserting software deliverable milestone acceptance on transportation line haul
    fake_deliverable_finding = {
        "finding_type": "Vague Deliverables & Disputed Payments",
        "clause_type": "Scope & Deliverables",
        "summary": "What counts as 'finished work' is phrased vaguely instead of with clear, objective criteria.",
        "evidence_quote": "Party B shall provide parcel transportation services on highway line-haul routes based on the needs of Party A.",
        "severity_score": 6,
    }
    is_valid, reason = validate_evidence_grounding(fake_deliverable_finding, ZTO_CONTRACT_TEXT)
    assert is_valid is False
    assert "deliverable" in reason.lower() or "acceptance" in reason.lower()

def test_evidence_grounding_accepts_legitimate_indemnity_when_present():
    contract_with_indemnity = "Party B shall indemnify, defend, and hold harmless Party A against all attorney's fees."
    legit_finding = {
        "finding_type": "Unbalanced Indemnification",
        "clause_type": "Indemnity",
        "summary": "Carrier is required to defend and indemnify shipper with no mutual protection.",
        "evidence_quote": "Party B shall indemnify, defend, and hold harmless Party A against all attorney's fees.",
        "severity_score": 8,
    }
    is_valid, reason = validate_evidence_grounding(legit_finding, contract_with_indemnity)
    assert is_valid is True
    assert reason == "Valid"

def test_deduplicate_findings_collapses_overlapping_agent_perspectives():
    findings = [
        {
            "chunk_id": uuid.uuid4(),
            "agent_name": "Opposing Counsel",
            "clause_type": "Pricing & Settlement",
            "finding_type": "Unilateral Weight & Freight Determination",
            "summary": "Party A determines EXW weight unilaterally.",
            "evidence_quote": "final clearance amount is subject to actual carriage amount and EX-warehouse (\"EXW\") weight determined by Party A.",
            "severity_score": 8,
            "risk_level": "Critical",
            "consensus_reasoning": {"deliberation": [{"agent": "Opposing Counsel", "score": 8}]}
        },
        {
            "chunk_id": uuid.uuid4(),
            "agent_name": "Risk & Liability Counsel",
            "clause_type": "Pricing & Settlement",
            "finding_type": "Unilateral Weight & Freight Determination",
            "summary": "EXW weight determined by Party A creates billing dispute risk.",
            "evidence_quote": "final clearance amount is subject to actual carriage amount and EX-warehouse (\"EXW\") weight determined by Party A.",
            "severity_score": 7,
            "risk_level": "High",
            "consensus_reasoning": {"deliberation": [{"agent": "Risk & Liability Counsel", "score": 7}]}
        }
    ]
    deduped = deduplicate_findings(findings)
    assert len(deduped) == 1
    # Check that highest severity was kept and agents merged
    assert deduped[0]["severity_score"] == 8
    assert "Opposing Counsel" in deduped[0]["agent_name"]
    assert "Risk & Liability Counsel" in deduped[0]["agent_name"]

def test_zto_contract_audit_pipeline_end_to_end():
    chunk = Chunk(
        id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        chunk_id=0,
        page_number=1,
        clause_type="Unspecified",
        party_scope="Unspecified",
        raw_text=ZTO_CONTRACT_TEXT.strip(),
        token_count=180
    )
    
    result = analyze_document_content([chunk])
    
    findings = result["findings"]
    finding_types = [f["finding_type"] for f in findings]
    summaries = " ".join([f["summary"] for f in findings])

    # TARGET PROBLEM 1 CHECK: NO FALSE POSITIVE INDEMNITY / LEGAL FEES
    assert not any("indemn" in ft.lower() for ft in finding_types), f"False positive indemnity found: {finding_types}"
    assert "lawsuit & legal fee trap" not in summaries.lower()
    assert "paying the other party's legal bills" not in summaries.lower()

    # TARGET PROBLEM 2 CHECK: NO FALSE POSITIVE 'FINISHED WORK' DELIVERABLES
    assert "finished work" not in summaries.lower()

    # TARGET PROBLEM 3 CHECK: THE 4 TARGET REAL RISKS ARE DETECTED
    # 1. Undefined Transportation Time (blank 4(a))
    assert any("transportation schedule" in ft.lower() or "transportation time" in ft.lower() for ft in finding_types), \
        f"Missing undefined transportation schedule finding. Got: {finding_types}"
    
    # 2. Indefinite Contract Term
    assert any("indefinite" in ft.lower() for ft in finding_types), \
        f"Missing indefinite term finding. Got: {finding_types}"
        
    # 3. Unilateral EXW Weight Determination
    assert any("unilateral" in ft.lower() or "weight" in ft.lower() for ft in finding_types), \
        f"Missing unilateral weight determination finding. Got: {finding_types}"
        
    # 4. Ambiguous Future Contract Language
    assert any("future" in ft.lower() or "subsequent" in ft.lower() for ft in finding_types), \
        f"Missing ambiguous future agreement finding. Got: {finding_types}"

    # TARGET PROBLEM 4 & 5 CHECK: DEDUPLICATION AND LIFECYCLE
    # Findings must have unique finding_type and evidence quote
    assert len(findings) == 4, f"Expected 4 target findings, but got {len(findings)}: {finding_types}"
    for f in findings:
        assert f["verification_status"] == "verified"
        assert f["lifecycle_stage"] == "final"
        # Quote must exist verbatim in ZTO text
        assert f["evidence_quote"][:30] in ZTO_CONTRACT_TEXT or f["evidence_quote"] in ZTO_CONTRACT_TEXT

    # TARGET PROBLEM 7 CHECK: RISK SCORE IS BASED STRICTLY ON FINAL FINDINGS
    assert 3.5 <= result["aggregate_risk_score"] <= 6.5
    assert result["risk_level"] in ("Low", "Medium", "High")
