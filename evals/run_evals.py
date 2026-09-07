#!/usr/bin/env python3
"""
Convenience entrypoint to execute LegalAid evaluations directly from the evals/ directory.
"""
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
SCRIPT_PATH = ROOT_DIR / "scripts" / "run_evals.py"

if __name__ == "__main__":
    import subprocess
    venv_python = ROOT_DIR / "services" / "ai" / ".venv" / "bin" / "python"
    python_bin = str(venv_python) if venv_python.exists() else sys.executable
    cmd = [python_bin, str(SCRIPT_PATH)] + sys.argv[1:]
    sys.exit(subprocess.call(cmd))
