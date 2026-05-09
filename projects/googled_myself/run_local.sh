#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  python -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

pip install -r requirements.txt

if [ ! -f ".env" ]; then
  cp .env.example .env
fi

python run_audit.py --config sample_inputs/config.yml --dry-run