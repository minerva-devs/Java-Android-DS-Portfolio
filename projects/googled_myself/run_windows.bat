@echo off
cd /d "%~dp0"

if not exist .venv (
    python -m venv .venv
)

call .venv\Scripts\activate

pip install -r requirements.txt

if not exist .env (
    copy .env.example .env
)

python run_audit.py --config sample_inputs\config.yml --dry-run
pause