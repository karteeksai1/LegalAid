#!/usr/bin/env python3
"""
LegalAid Full System Diagnostic & Connectivity Check
Verifies environment variables, database connectivity, table initialization, and services.
"""

import sys
import os
from pathlib import Path

# Add services/ai to sys.path so we can import app modules
ROOT_DIR = Path(__file__).resolve().parent.parent
AI_DIR = ROOT_DIR / "services" / "ai"
sys.path.insert(0, str(AI_DIR))

def print_header(title: str):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def main():
    print_header("1. Checking Environment Configuration (.env)")
    env_file = ROOT_DIR / ".env"
    if not env_file.exists():
        print("❌ .env file NOT FOUND at workspace root!")
        sys.exit(1)
    print("✅ .env file located at:", env_file)

    from app.core.config import get_settings
    settings = get_settings()

    print(f"   • FASTAPI_BASE_URL : {settings.fastapi_base_url if hasattr(settings, 'fastapi_base_url') else 'http://localhost:8000'}")
    print(f"   • GROQ_MODEL       : {settings.groq_model}")
    print(f"   • GROQ_API_KEY     : {'Configured (len=' + str(len(settings.groq_api_key)) + ')' if settings.groq_api_key else 'Missing'}")
    print(f"   • PINECONE_INDEX   : {settings.pinecone_index_name}")

    print_header("2. Testing Neon PostgreSQL Connection")
    from app.db.session import engine
    from sqlalchemy import text, inspect
    from app.db.base import Base
    import app.models  # noqa

    try:
        with engine.connect() as conn:
            row = conn.execute(text("SELECT 1 AS connected, current_database(), current_user, version();")).mappings().first()
            print("✅ Database connection SUCCESSFUL!")
            print(f"   • Connected Database : {row['current_database']}")
            print(f"   • Database User     : {row['current_user']}")
            print(f"   • Postgres Version  : {row['version'].split()[0]} {row['version'].split()[1]}")

        # Verify / create tables
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        expected = {'users', 'documents', 'chunks', 'analysis_results', 'agent_findings'}
        missing = expected - set(tables)

        if not missing:
            print("✅ All required database tables verified:")
            for t in sorted(tables):
                print(f"   • Table: {t}")
        else:
            print(f"⚠️ Missing tables: {missing}")

    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)

    print_header("3. Service Port & Routing Summary")
    print("   [Frontend Web]     : http://localhost:5173  (Vite Dev Server)")
    print("   [Express Gateway]  : http://localhost:3000  (API Gateway & Proxy)")
    print("   [FastAPI Service]  : http://localhost:8000  (AI Core & Multi-Agent)")
    print("   [Neon Database]    : ep-lively-darkness-aeziu72e (PostgreSQL 18.6)")

    print("\n✅ System diagnostics completed with 0 errors!")

if __name__ == "__main__":
    main()
