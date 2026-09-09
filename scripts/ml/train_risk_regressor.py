#!/usr/bin/env python3
"""
Training and evaluation script for Risk Scoring Engine (Model 2).
Trains classical ML regressors (Gradient Boosting, Random Forest, Ridge, HistGradientBoosting)
on structured multi-agent outputs.
Reports validation RMSE, MAE, R^2, and feature importances.
Serializes best model to services/ai/app/ml/models/risk_scoring_regressor.joblib.
"""

import json
import os
import sys
from pathlib import Path
import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
AI_DIR = ROOT_DIR / "services" / "ai"
for p in [str(AI_DIR), str(ROOT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import joblib
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

DATA_PATH = ROOT_DIR / "evals" / "data" / "risk_training_dataset.json"
MODEL_OUTPUT_DIR = AI_DIR / "app" / "ml" / "models"
MODEL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MODEL_FILE = MODEL_OUTPUT_DIR / "risk_scoring_regressor.joblib"


def main():
    print("=" * 80)
    print("  TRAINING RISK SCORING REGRESSOR (MODEL 2)")
    print("=" * 80)

    if not DATA_PATH.exists():
        print(f"Error: Dataset not found at {DATA_PATH}. Run prepare_risk_data.py first.")
        sys.exit(1)

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    # Feature names from first record
    feature_names = sorted(list(dataset[0]["features"].keys()))
    print(f"Loaded {len(dataset)} training samples with {len(feature_names)} structured features.")

    X = np.array([[d["features"][k] for k in feature_names] for d in dataset], dtype=np.float32)
    y = np.array([d["consensus_risk_score"] for d in dataset], dtype=np.float32)

    # 80/20 train/validation split
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.20, random_state=42
    )
    print(f"Training set: {len(X_train)} samples | Validation set: {len(X_val)} samples\n")

    candidate_models = {
        "GradientBoosting": GradientBoostingRegressor(n_estimators=100, max_depth=3, learning_rate=0.08, random_state=42),
        "RandomForest": RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42),
        "HistGradientBoosting": HistGradientBoostingRegressor(max_iter=100, random_state=42),
        "RidgeRegression": Ridge(alpha=1.0)
    }

    results = {}
    fitted_pipelines = {}

    print(f"{'Model':<24} | {'RMSE':<9} | {'MAE':<9} | {'R² Score':<9}")
    print("-" * 58)

    best_name = None
    best_rmse = float("inf")

    for name, reg in candidate_models.items():
        pipe = Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", reg)
        ])
        pipe.fit(X_train, y_train)
        fitted_pipelines[name] = pipe

        y_pred = pipe.predict(X_val)
        rmse = float(np.sqrt(mean_squared_error(y_val, y_pred)))
        mae = float(mean_absolute_error(y_val, y_pred))
        r2 = float(r2_score(y_val, y_pred))

        results[name] = {"rmse": rmse, "mae": mae, "r2": r2}
        print(f"{name:<24} | {rmse:<9.4f} | {mae:<9.4f} | {r2:<9.4f}")

        if rmse < best_rmse:
            best_rmse = rmse
            best_name = name

    print("-" * 58)
    print(f"Selected Best Performing Model: {best_name} (RMSE = {best_rmse:.4f}, R² = {results[best_name]['r2']:.4f})\n")

    best_pipe = fitted_pipelines[best_name]

    # Retrain on 100% data for deployment
    print("Retraining best regressor on full dataset (100% data) for production deployment...")
    best_pipe.fit(X, y)

    # Save dictionary with model, feature names, and metadata
    model_payload = {
        "pipeline": best_pipe,
        "feature_names": feature_names,
        "model_name": best_name,
        "metrics": results[best_name]
    }
    joblib.dump(model_payload, MODEL_FILE)
    print(f"Serialized Model Artifact: {MODEL_FILE} ({MODEL_FILE.stat().st_size / 1024:.1f} KB)\n")

    # Feature Importance Inspection
    print("=" * 80)
    print("  EXPLAINABLE FEATURE IMPORTANCE ANALYSIS")
    print("=" * 80)

    regressor = best_pipe.named_steps["regressor"]
    if hasattr(regressor, "feature_importances_"):
        importances = regressor.feature_importances_
        top_indices = np.argsort(importances)[::-1]
        print("Top 10 Risk Drivers (Features with highest impact on final risk score):")
        for rank, idx in enumerate(top_indices[:10], 1):
            print(f"  {rank:>2}. {feature_names[idx]:<38}: {importances[idx]:.4f} ({importances[idx]*100:.1f}%)")
    elif hasattr(regressor, "coef_"):
        coefs = regressor.coef_
        top_indices = np.argsort(np.abs(coefs))[::-1]
        print("Top 10 Linear Coefficients (Impact on final risk score):")
        for rank, idx in enumerate(top_indices[:10], 1):
            print(f"  {rank:>2}. {feature_names[idx]:<38}: {coefs[idx]:+.4f}")

    # Sanity inference check across risk tiers
    print("\n" + "=" * 80)
    print("  TIER PREDICTION SANITY CHECK")
    print("=" * 80)

    from scripts.ml.prepare_risk_data import generate_synthetic_document_profiles, extract_structured_risk_features

    test_samples = generate_synthetic_document_profiles()
    sample_picks = [
        ("Low Risk Standard Contract", test_samples[0]["findings"]),
        ("Moderate Risk Commercial Lease", test_samples[15]["findings"]),
        ("High Risk Unilateral Indemnity", test_samples[28]["findings"]),
        ("Critical Risk Multi-Vulnerability", test_samples[40]["findings"]),
    ]

    print(f"{'Contract Scenario':<38} | {'Findings':<8} | {'Predicted Risk Score':<22}")
    print("-" * 74)
    for title, findings in sample_picks:
        feats_dict = extract_structured_risk_features(findings)
        x_vec = np.array([[feats_dict[k] for k in feature_names]], dtype=np.float32)
        score = float(best_pipe.predict(x_vec)[0])
        score = max(1.0, min(10.0, round(score, 1)))

        if score >= 8.0:
            level = "Critical"
        elif score >= 6.5:
            level = "High"
        elif score >= 4.0:
            level = "Medium"
        else:
            level = "Low"

        print(f"{title:<38} | {len(findings):<8} | {score:>4.1f}/10 ({level})")
    print("=" * 80)


if __name__ == "__main__":
    main()
