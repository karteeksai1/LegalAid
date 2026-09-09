#!/usr/bin/env python3
"""
Training and evaluation script for Legal Document Validity Classifier (Model 1).
Trains classical ML models (Logistic Regression, Calibrated LinearSVC, HistGradientBoosting, Random Forest)
on domain-engineered legal features + TF-IDF vectors.
Reports validation Accuracy, Precision, Recall, F1, ROC-AUC, and feature importances.
Serializes the best pipeline to services/ai/app/ml/models/validity_classifier.joblib.
"""

import json
import os
import sys
from pathlib import Path
import numpy as np

# Ensure services/ai and ROOT_DIR are on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
AI_DIR = ROOT_DIR / "services" / "ai"
for p in [str(AI_DIR), str(ROOT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import joblib
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.svm import LinearSVC
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, classification_report

from app.ml.feature_extractor import LegalDocumentFeatureExtractor

DATA_PATH = ROOT_DIR / "evals" / "data" / "validity_training_dataset.json"
MODEL_OUTPUT_DIR = AI_DIR / "app" / "ml" / "models"
MODEL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MODEL_FILE = MODEL_OUTPUT_DIR / "validity_classifier.joblib"


from sklearn.preprocessing import FunctionTransformer, StandardScaler

def build_pipeline(classifier, requires_dense=False):
    """Build composite pipeline: Domain Features + TF-IDF -> Classifier"""
    features = FeatureUnion([
        ("domain_features", Pipeline([
            ("extractor", LegalDocumentFeatureExtractor()),
            ("scaler", StandardScaler())
        ])),
        ("tfidf", TfidfVectorizer(
            max_features=250,
            ngram_range=(1, 2),
            stop_words="english",
            sublinear_tf=True
        ))
    ])
    steps = [("features", features)]
    if requires_dense:
        steps.append(("to_dense", FunctionTransformer(lambda x: x.toarray() if hasattr(x, "toarray") else x, accept_sparse=True)))
    steps.append(("classifier", classifier))
    return Pipeline(steps)


def main():
    print("=" * 80)
    print("  TRAINING LEGAL DOCUMENT VALIDITY CLASSIFIER (MODEL 1)")
    print("=" * 80)

    if not DATA_PATH.exists():
        print(f"Error: Dataset not found at {DATA_PATH}. Run prepare_validity_data.py first.")
        sys.exit(1)

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    texts = [d["text"] for d in dataset]
    labels = np.array([d["label"] for d in dataset], dtype=int)
    filenames = [d["filename"] for d in dataset]

    print(f"Total dataset: {len(texts)} documents (Legal: {sum(labels==1)}, Non-Legal: {sum(labels==0)})")

    # 80/20 Stratified train/validation split
    X_train, X_val, y_train, y_val, files_train, files_val = train_test_split(
        texts, labels, filenames, test_size=0.20, random_state=42, stratify=labels
    )
    print(f"Training split: {len(X_train)} samples | Validation split: {len(X_val)} samples\n")

    candidate_models = {
        "LogisticRegression": LogisticRegression(C=1.5, max_iter=1000, random_state=42),
        "CalibratedLinearSVC": CalibratedClassifierCV(LinearSVC(C=1.0, random_state=42, dual=True)),
        "RandomForest": RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42),
        "HistGradientBoosting": HistGradientBoostingClassifier(max_iter=80, random_state=42)
    }

    results = {}
    fitted_pipelines = {}

    print(f"{'Model':<24} | {'Accuracy':<9} | {'Precision':<9} | {'Recall':<8} | {'F1-Score':<8} | {'ROC-AUC':<8}")
    print("-" * 78)

    best_name = None
    best_f1 = -1.0

    for name, clf in candidate_models.items():
        requires_dense = (name == "HistGradientBoosting")
        pipe = build_pipeline(clf, requires_dense=requires_dense)
        pipe.fit(X_train, y_train)
        fitted_pipelines[name] = pipe

        y_pred = pipe.predict(X_val)
        y_prob = pipe.predict_proba(X_val)[:, 1] if hasattr(pipe, "predict_proba") else y_pred

        acc = accuracy_score(y_val, y_pred)
        prec = precision_score(y_val, y_pred, zero_division=0)
        rec = recall_score(y_val, y_pred, zero_division=0)
        f1 = f1_score(y_val, y_pred, zero_division=0)
        roc = roc_auc_score(y_val, y_prob)

        results[name] = {
            "accuracy": acc,
            "precision": prec,
            "recall": rec,
            "f1": f1,
            "roc_auc": roc
        }

        print(f"{name:<24} | {acc:<9.4f} | {prec:<9.4f} | {rec:<8.4f} | {f1:<8.4f} | {roc:<8.4f}")

        if f1 > best_f1:
            best_f1 = f1
            best_name = name

    print("-" * 78)
    print(f"Selected Best Performing Model: {best_name} (F1 = {best_f1:.4f})\n")

    best_pipe = fitted_pipelines[best_name]

    # Retrain best pipeline on full dataset to maximize production coverage
    print("Retraining best model on full dataset (100% data) for deployment serialization...")
    best_pipe.fit(texts, labels)

    # Serialize trained model pipeline
    joblib.dump(best_pipe, MODEL_FILE)
    print(f"Serialized Model Artifact: {MODEL_FILE} ({MODEL_FILE.stat().st_size / 1024:.1f} KB)\n")

    # Feature Importance Inspection
    print("=" * 80)
    print("  EXPLAINABLE FEATURE ANALYSIS")
    print("=" * 80)
    domain_names = LegalDocumentFeatureExtractor.FEATURE_NAMES
    
    # If logistic regression or linear model
    if hasattr(best_pipe.named_steps["classifier"], "coef_"):
        coefs = best_pipe.named_steps["classifier"].coef_[0]
        domain_coefs = coefs[:len(domain_names)]
        top_indices = np.argsort(domain_coefs)[::-1]
        print("Top Positive Legal Indicators (High weights => Legal Document):")
        for idx in top_indices[:8]:
            print(f"  • {domain_names[idx]:<28}: +{domain_coefs[idx]:.4f}")
    elif hasattr(best_pipe.named_steps["classifier"], "feature_importances_"):
        importances = best_pipe.named_steps["classifier"].feature_importances_
        domain_imp = importances[:len(domain_names)]
        top_indices = np.argsort(domain_imp)[::-1]
        print("Top Domain Feature Importances (MDI):")
        for idx in top_indices[:8]:
            print(f"  • {domain_names[idx]:<28}: {domain_imp[idx]:.4f}")
    else:
        print("Model uses calibrated decision function with combined domain & n-gram features.")

    # Edge Case Testing
    print("\n" + "=" * 80)
    print("  CRITICAL EDGE-CASE INFERENCE VERIFICATION")
    print("=" * 80)

    from scripts.ml.prepare_validity_data import (
        SPMCIL_NDA_TEMPLATE, ID_CARD_STUDENT, ID_CARD_DRIVER_LICENSE,
        RESUME_SOFTWARE_ENGINEER, INVOICE_BILLING
    )

    test_cases = [
        ("SPMCIL NDA Template (Unsigned with blanks)", SPMCIL_NDA_TEMPLATE, 1),
        ("Student Identity Card", ID_CARD_STUDENT, 0),
        ("Driver's License", ID_CARD_DRIVER_LICENSE, 0),
        ("Software Engineer Resume", RESUME_SOFTWARE_ENGINEER, 0),
        ("Commercial Consulting Invoice", INVOICE_BILLING, 0),
    ]

    print(f"{'Test Document':<42} | {'True':<5} | {'P(Legal)':<9} | {'Predicted Decision':<20}")
    print("-" * 80)
    for name, text, true_lbl in test_cases:
        prob = float(best_pipe.predict_proba([text])[0, 1])
        if prob >= 0.60:
            status = "VALID CONTRACT"
        elif prob >= 0.40:
            status = "BORDERLINE (Soft Alert)"
        else:
            status = "REJECTED (Non-Legal)"

        true_str = "Legal" if true_lbl == 1 else "Non-L"
        passed = (prob >= 0.40 and true_lbl == 1) or (prob < 0.40 and true_lbl == 0)
        mark = "✓ PASS" if passed else "✗ FAIL"
        print(f"{name:<42} | {true_str:<5} | {prob:<9.4f} | {status:<20} {mark}")

    print("=" * 80)


if __name__ == "__main__":
    main()
