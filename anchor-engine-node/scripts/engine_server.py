#!/usr/bin/env python3
"""
Anchor Engine Server Wrapper - LLM Dev Edition (Fixed for ES Modules)

A simple Python wrapper to manage the Anchor Engine lifecycle.
Provides a clean API for starting and stopping the engine without tool_call formatting issues.

Location: scripts/engine_server.py
Spec: ux-ui-recursion-workflow.md (Prerequisites & Setup section)
"""

import subprocess
import sys
import os
from pathlib import Path

# Get the project root directory (go up two levels from scripts/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def start_engine():
    """Start the Anchor Engine with full logging - LLM Dev Edition."""
    print("=" * 60)
    print("Anchor Engine Server Wrapper (LLM Dev Edition)")
    print("=" * 60)
    
    # Step 1: Check if engine is already running
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', 3160))
        if result == 0:
            print("[OK] Engine already running on port 3160")
            sock.close()
            return
        else:
            print("[INFO] No engine running, starting...")
            sock.close()
    except Exception as e:
        print(f"[WARN] Could not check port: {e}")
    
    # Step 2: Start the engine using pnpm start
    # This runs: node --expose-gc engine/dist/index.js
    print("\n[1/1] Starting Anchor Engine via pnpm start...")
    
    result = subprocess.run(
        "pnpm start",
        cwd=PROJECT_ROOT,
        shell=True,
        capture_output=False,
        text=True
    )
    
    print("\n" + "=" * 60)
    print("Anchor Engine started successfully!")
    print("=" * 60)
    print(f"Server running on http://localhost:3160")
    print(f"Logs available at .anchor/logs/")