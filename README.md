# Minerva Franco — Data Science & Tech Portfolio

## UNDER CONSTRUCTION ##

[![CI](https://img.shields.io/badge/ci-py%20%2B%20java-blue)]() [![tests](https://img.shields.io/badge/tests-passing-brightgreen)]() [![license](https://img.shields.io/badge/license-MIT-lightgrey)]()

Full‑stack portfolio combining Android (Java/Kotlin), backend (Spring Boot), and Data Science (Python, ML, ETL). Demo apps, reproducible notebooks, and a privacy‑focused personal data audit tool - all with tests and CI. Contact: minefq@yahoo.com • https://www.linkedin.com/in/minervacfranco • https://github.com/Minerva-Devs/Java-Android-DataScience-Portfolio

---

## Quick demo (30–90s)
- See a short demo GIF of the Googled_Myself audit and an Android screenflow in /docs/demo.gif (or open the individual project README links below).
- Fast verification: run the sanitized Python audit in dry‑run mode (commands below) to see outputs without any real web queries.

---

## Project index
| Project | Type | Tech stack | Status | Link |
|---|---:|---|---|---|
| Googled_Myself | Personal data audit (privacy/OSINT) | Python, asyncio, aiohttp, BeautifulSoup, SerpAPI | Ready (sample data + dry‑run) | /projects/googled_myself/README.md |
| SpaceSeek | Android app | Java, Android SDK, MVVM, Retrofit | Demo | /projects/space_seek/README.md |
| Farkle (Capstone) | Multiplayer game (backend + mobile) | Spring Boot, REST, Android (Jetpack) | Demo | /projects/farkle/README.md |
| Chat App | Android real‑time chat | Firebase, Android | Demo | /projects/chat_app/README.md |
| Data Science Notebooks | ML & ETL | Python, Pandas, TensorFlow, scikit‑learn | Notebooks + tests | /projects/data_science/README.md |
| Algorithms & DS | Coding challenges | Java | Ready | /projects/algorithms/README.md |

---

## Quick evaluation commands 
Clone and run the sanitized audit demo (no real scraping by default):
```bash
git clone https://github.com/minerva-devs/Java-Android-DataScience-Portfolio.git
cd Java-Android-DataScience-Portfolio/projects/googled_myself
cp .env.example .env
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# run a safe dry-run using sample inputs (no external queries)
python -m googled_myself.run_audit --config sample_inputs/config.yml --dry-run
# run tests
pytest -q
```

Android quick check (prebuilt APK or emulator instructions in project README):
- Open the Android project in Android Studio > Build > Run (see /projects/space_seek/README.md for APK and emulator shortcuts).

Docker demo (PENDING):
```bash
docker build -t googled_myself:demo projects/googled_myself
docker run --rm googled_myself:demo --config /app/sample_inputs/config.yml --dry-run
```

---

## How to read this portfolio quickly (3 checks)
1. Run the sanitized Python audit (one command above) — verifies reproducibility, dependency management, and safe demos.
2. Check unit tests for ML/parsing logic (pytest) — demonstrates testability and data validation.
3. Open Android project(s) and run the emulator or inspect architecture: MVVM, Room DB, Retrofit usage, and sample UI flows.

---

## Reproducibility & environment
- Python: use the provided requirements.txt or pyproject.toml. Activate venv before installing.
- Java/Android: JDK 11+, Android Studio (project gradle wrapper included).
- Dockerfiles included for reproducible runs where applicable.
- .env.example present in each sensitive project — never commit real keys. repo .gitignore excludes .env, audit_results/, and .venv/.

---

## Testing, CI & quality signals
- Unit tests (pytest for Python, junit for Java) located in each project folder under tests/.
- GitHub Actions workflow runs lint + tests on PRs: .github/workflows/ci.yml.
- CI badges at top indicate build and test status.
- PII safety: projects containing sensitive operations default to --dry-run and include explicit runtime confirmation to prevent accidental live scans.

---

## Googled_Myself — Personal data audit 
- Purpose: Async diagnostic tool to detect publicly indexed personal identifiers and generate a structured risk report.
- Tech: Python 3.x, asyncio, aiohttp, BeautifulSoup, SerpAPI; exports: JSON/CSV/XLSX.
- Key safety features included here: sample_inputs/ (sanitized), --dry-run default, .env.example, and runtime guard requiring explicit --confirm-live to run real queries.

See full project README: /projects/googled_myself/README.md

---
