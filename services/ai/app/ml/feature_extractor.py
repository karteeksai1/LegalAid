"""
Feature extraction pipeline for Legal Document Validity Classifier.
Extracts interpretable domain features from raw document text:
- Legal keyword density and vocabulary richness
- Clause and section numbering structures
- Defined-party language patterns and recitals
- Word count and prose-to-placeholder ratio (template friendliness)
- Signature block and execution language
"""

import re
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin

LEGAL_KEYWORDS = [
    "shall", "hereby", "indemnify", "indemnification", "indemnity",
    "party", "parties", "agreement", "whereas", "covenant", "covenants",
    "liability", "termination", "governing law", "jurisdiction", "severability",
    "confidential", "confidentiality", "intellectual property", "warranties",
    "representations", "in witness whereof", "arbitration", "counterparts",
    "remedies", "breach", "obligations", "obligation", "disclosing party",
    "receiving party", "permitted disclosures", "survival", "force majeure"
]

OBLIGATION_VERBS = [
    r"\bshall\b",
    r"\bshall\s+not\b",
    r"\bagrees?\s+to\b",
    r"\bhereby\s+agrees?\b",
    r"\bcovenants?\s+that\b",
    r"\bundertakes?\s+to\b",
    r"\bhold[s]?\s+harmless\b",
    r"\bindemnif(?:y|ies|ication)\b",
    r"\bwarrants?\s+and\s+represents?\b"
]

DEFINED_PARTY_PATTERNS = [
    r"\b(?:hereinafter\s+referred\s+to\s+as|hereinafter\s+called|referred\s+to\s+as\s+the)\b",
    r"\b(?:by\s+and\s+between|entered\s+into\s+by|entered\s+into\s+on|between\s+and\s+among)\b",
    r"\b(?:disclosing\s+part(?:y|ies)|receiving\s+part(?:y|ies)|the\s+parties\s+hereto)\b",
    r"\b(?:the\s+company|the\s+contractor|the\s+vendor|the\s+bidder|the\s+client|the\s+purchaser)\b",
    r'"[A-Z][a-zA-Z\s]{2,25}"\s*(?:\(|,|$)'
]

SECTION_PATTERNS = [
    r"(?m)^\s*(?:section|article|clause|paragraph)\s+\d+(?:\.\d+)*\b",
    r"(?m)^\s*\d+\.\d+\s+[A-Z]",
    r"\b(?:section|article|clause)\s+\d+\b"
]

SIGNATURE_PATTERNS = [
    r"\bin\s+witness\s+whereof\b",
    r"\bauthorized\s+signator(?:y|ies)\b",
    r"\bsigned\s+for\s+and\s+on\s+behalf\s+of\b",
    r"(?m)^\s*(?:By|Name|Title|Date|Signature):\s*",
    r"\bexecuted\s+as\s+of\s+the\s+date\b"
]

PLACEHOLDER_PATTERNS = [
    r'_{2,}',
    r'\.{3,}',
    r'-{3,}',
    r'\[[\s_.-]*\]',
    r'\([\s_.-]{2,}\)',
    r'\[(?:insert|date|name|party|company|title)[^\]]*\]'
]


class LegalDocumentFeatureExtractor(BaseEstimator, TransformerMixin):
    """
    Extracts high-signal, interpretable numerical features from document text.
    Engineered to distinguish real legal contracts (including unsigned templates)
    from non-legal documents (ID cards, resumes, receipts, news, code).
    """

    FEATURE_NAMES = [
        "legal_keyword_count",
        "legal_keyword_density",
        "unique_legal_keywords",
        "legal_vocab_richness",
        "obligation_verb_count",
        "obligation_density",
        "defined_party_count",
        "section_structure_count",
        "section_density",
        "signature_block_count",
        "log_word_count",
        "placeholder_count",
        "placeholder_density",
        "prose_to_placeholder_ratio",
        "template_structural_score",
        "title_contract_indicator"
    ]

    def __init__(self):
        pass

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        """
        X: Iterable of raw document strings
        Returns: 2D numpy array of shape (len(X), len(FEATURE_NAMES))
        """
        features_list = []
        for text in X:
            features_list.append(self._extract_features(text))
        return np.array(features_list, dtype=np.float32)

    def _extract_features(self, text: str) -> list[float]:
        if not text or not isinstance(text, str):
            return [0.0] * len(self.FEATURE_NAMES)

        norm_text = text.lower()
        words = re.findall(r'\b[a-zA-Z]{2,}\b', norm_text)
        word_count = max(1, len(words))
        words_per_k = word_count / 1000.0

        # 1. Legal Keywords
        kw_counts = [len(re.findall(r'\b' + re.escape(kw) + r'\b', norm_text)) for kw in LEGAL_KEYWORDS]
        total_kw_count = sum(kw_counts)
        unique_kws = sum(1 for c in kw_counts if c > 0)
        kw_density = total_kw_count / words_per_k
        vocab_richness = unique_kws / len(LEGAL_KEYWORDS)

        # 2. Obligation Verbs
        obl_count = sum(len(re.findall(p, norm_text)) for p in OBLIGATION_VERBS)
        obl_density = obl_count / words_per_k

        # 3. Defined Parties
        party_count = sum(len(re.findall(p, norm_text)) for p in DEFINED_PARTY_PATTERNS)

        # 4. Section & Clause Numbering
        section_count = sum(len(re.findall(p, norm_text)) for p in SECTION_PATTERNS)
        section_density = section_count / words_per_k

        # 5. Signature Block
        sig_count = sum(len(re.findall(p, norm_text)) for p in SIGNATURE_PATTERNS)

        # 6. Placeholders & Templates (crucial: templates contain placeholders like _____ and [Name])
        placeholder_count = sum(len(re.findall(p, text)) for p in PLACEHOLDER_PATTERNS)
        placeholder_density = placeholder_count / words_per_k
        prose_to_placeholder_ratio = word_count / (word_count + placeholder_count * 5.0)

        # Structural score that specifically recognizes unsigned templates:
        # A template with defined parties, section numbering, and placeholders is a contract template!
        template_score = float(party_count > 0 and section_count > 0 and placeholder_count > 0)

        # Title indicator
        has_title = bool(re.search(r'\b(?:agreement|contract|non[-\s]*disclosure|nda|memorandum\s+of\s+understanding|sla|lease|license)\b', norm_text[:300]))
        title_indicator = 1.0 if has_title else 0.0

        log_words = float(np.log1p(word_count))

        return [
            float(total_kw_count),
            float(kw_density),
            float(unique_kws),
            float(vocab_richness),
            float(obl_count),
            float(obl_density),
            float(party_count),
            float(section_count),
            float(section_density),
            float(sig_count),
            float(log_words),
            float(placeholder_count),
            float(placeholder_density),
            float(prose_to_placeholder_ratio),
            float(template_score),
            float(title_indicator)
        ]

    def get_feature_names_out(self, input_features=None):
        return np.array(self.FEATURE_NAMES, dtype=object)
