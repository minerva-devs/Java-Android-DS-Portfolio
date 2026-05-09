Full /projects/googled_myself/README.md (paste into projects/googled_myself/README.md)

# Googled_Myself — Personal Data Audit (sanitized demo)

Short description
A privacy‑focused, async personal digital footprint auditor that detects publicly indexed identifiers and produces a structured risk report. This project is designed for educational and self‑audit use only; by default it runs in safe "dry‑run" mode using sanitized sample inputs.

Quick links
- Demo (sanitized): ../docs/demo.gif
- Sample report (sanitized): sample_outputs/sample_report.json
- Run demo locally (safe): python -m googled_myself.run_audit --config sample_inputs/config.yml --dry-run

Why this project matters
Publicly indexed data can enable phishing, social engineering, and identity theft. This tool demonstrates:
- Async scraping and ETL pipeline design
- Heuristic risk scoring and report export (JSON/CSV/XLSX)
- Ethical safeguards to prevent accidental live queries

Table of contents
- Quick start
- Features
- Architecture
- Safety & ethical use
- Sample outputs
- Configuration
- Running (dry‑run)
- Running (live) — guarded
- Tests & CI
- Development & packaging
- Limitations
- License & acknowledgments
- Contact

Quick start (sanitized demo)
```bash
git clone https://github.com/minerva-devs/Java-Android-DataScience-Portfolio.git
cd Java-Android-DataScience-Portfolio/projects/googled_myself
cp .env.example .env
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# run safe demo (no external queries)
python -m googled_myself.run_audit --config sample_inputs/config.yml --dry-run
# run tests
pytest -q
```

Features
- Async query expansion and concurrent scraping using asyncio + aiohttp
- HTML parsing with BeautifulSoup and robust match detection
- Heuristic risk scoring (phone, email, name weights) with sample scoring thresholds
- Export to JSON, CSV, and XLSX
- Sample_inputs directory with sanitized queries
- --dry-run default and explicit --confirm-live required for external queries
- Dockerfile for reproducible demo runs

Architecture
- Pipeline pattern: Query Expansion -> URL Retrieval -> Async Scraping -> Parsing -> Match Detection -> Risk Scoring -> Export
- Concurrent Worker Pattern: asyncio-based workers with bounded concurrency
- Lightweight ETL: extract HTML, transform to normalized records, load to structured report

Safety & ethical use
- This repository contains NO real personal data. sample_inputs/ and sample_outputs/ are sanitized.
- By default the tool runs in --dry-run mode which processes only local sample files.
- To run live queries you must:
  1) Provide SERPAPI_KEY in .env,
  2) Acknowledge Terms by passing --confirm-live,
  3) Understand API quotas and legal/ethical obligations.
- Respect robots.txt and site Terms of Service. Do not target third parties without permission.

Sample outputs
- sample_outputs/sample_report.json — contains risk entries with fields: query, url, matches [{type, snippet, score}], total_risk_score.
- sample_outputs/sample_report.xlsx — Excel export showing summary and detailed findings.

Configuration
- .env.example — placeholders for SERPAPI_KEY and optional config.
- sample_inputs/config.yml — demo config (search queries, domains, max_pages).
- requirements.txt — Python deps.
- Dockerfile — builds demo image and runs in dry-run by default.

Running (dry‑run)
- Default mode used in CI and demo workflows. Uses sample_inputs/ HTML files and queries without reaching external services.
- Command:
  python -m googled_myself.run_audit --config sample_inputs/config.yml --dry-run

Running (live) — guarded
- Live runs require SERPAPI_KEY and explicit confirmation:
  python -m googled_myself.run_audit --config sample_inputs/config.yml --confirm-live
- Live runs will consume API quota and may be rate limited. Use responsibly.

Tests & CI
- pytest tests in tests/ include:
  - test_parser.py — parsing and snippet extraction
  - test_scoring.py — heuristic scoring behavior
- GitHub Actions workflow (.github/workflows/ci.yml) runs lint + tests on PRs.
- CI defaults to dry-run; live mode is not run in CI.

Development & packaging
- Package structure supports import via python -m googled_myself.run_audit
- To build Docker demo:
  docker build -t googled_myself:demo .
  docker run --rm googled_myself:demo --config sample_inputs/config.yml --dry-run

Limitations
- Detects only publicly indexed content; cannot access dark web or private content.
- Heuristic scoring is non-standard and intended for demonstration; not a replacement for professional risk assessments.

License & acknowledgments
- MIT License — see LICENSE at repo root.
- Thanks to CNM Ingenuity instructors and bootcamp mentors for guidance.

Contact
Minerva Franco — minefq@yahoo.com