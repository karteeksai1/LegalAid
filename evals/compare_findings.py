#!/usr/bin/env python3
"""
Convenience entrypoint to execute LegalAid findings comparison directly from evals/
"""
import sys
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
SCRIPT_PATH = ROOT_DIR / "scripts" / "compare_findings.py"

if __name__ == "__main__":
    venv_python = ROOT_DIR / "services" / "ai" / ".venv" / "bin" / "python"
    python_bin = str(venv_python) if venv_python.exists() else sys.executable
    cmd = [python_bin, str(SCRIPT_PATH)] + sys.argv[1:]
    sys.exit(subprocess.call(cmd))
