# Minerva Franco — Data Science, Systems & Tech Portfolio

## UNDER CONSTRUCTION ##

[![CI](https://img.shields.io/badge/ci-py%20%2B%20java%20%2B%20ts-blue)]() [![tests](https://img.shields.io/badge/tests-passing-brightgreen)]() [![license](https://img.shields.io/badge/license-MIT-lightgrey)]()

Co-founder and systems engineer specializing in production-ready software architectures, applied data science workflows, and deterministic AI memory infrastructure. This portfolio consolidates my work across:

* **Startup Infrastructure:** Multi-workspace core engine services and deterministic AI memory layers.
* **Mobile & Backend:** Clean Architecture Android applications (Java/Kotlin) paired with Spring Boot backends.
* **Applied Data Science:** Privacy-preserving OSINT data auditing tools, reproducible pipelines, and targeted ML workflows.

**Contact & Profiles:** 📩 minefq@yahoo.com • 💼 [LinkedIn](https://www.linkedin.com/in/minervacfranco) • 💻 [GitHub Portfolio](https://github.com/Minerva-Devs/tech-portfolio)

---

## Quick demo (30–90s)
- See a short demo GIF of the Googled_Myself audit and an Android screenflow in /docs/demo.gif (or open the individual project README links below).
- Fast verification: run the sanitized Python audit in dry‑run mode (commands below) to see outputs without any real web queries.

---

## Project index
| Project | Type | Tech stack | Status | Link |
|---|---:|---|---|---|
| Googled_Myself | Personal data audit (privacy/OSINT) | Python, asyncio, aiohttp, BeautifulSoup, SerpAPI | Ready (sample data + dry‑run) | /projects/googled_myself/README.md |
| Anchor Engine Node | Startup Infrastructure / AI Memory | TypeScript, Node.js, pnpm Workspaces, ts-node | Production Ready (v5.2.0) | /engine/README.md |
| SpaceSeek | Android app | Java, Android SDK, MVVM, Retrofit | Demo | /projects/space_seek/README.md |
| Farkle (Capstone) | Multiplayer game (backend + mobile) | Spring Boot, REST, Android (Jetpack) | Demo | /projects/farkle/README.md |
| Chat App | Android real‑time chat | Firebase, Android | Demo | /projects/chat_app/README.md |
| Data Science Notebooks | ML & ETL | Python, Pandas, TensorFlow, scikit‑learn | Notebooks + tests | /projects/data_science/README.md |
| Algorithms & DS | Coding challenges | Java | Ready | /projects/algorithms/README.md |

---

## Quick evaluation commands 
Clone and run the sanitized audit demo (no real scraping by default):
```bash
git clone https://github.com/minerva-devs/tech-portfolio.git
cd tech-portfolio/projects/googled_myself
cp .env.example .env
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# run a safe dry-run using sample inputs (no external queries)
python -m googled_myself.run_audit --config sample_inputs/config.yml --dry-run
# run tests
pytest -q
# Anchor Engine Core - Initialize & Run Workspace 
git clone https://github.com/minerva-devs/anchor-engine-node.git
cd anchor-engine-node
pnpm install
# Bypass root-level pipeline limits using explicit workspace filtering
pnpm --filter engine start

```
## Quick evaluation commands

###  Project 1: Googled_Myself (Personal Data Audit Pipeline)
Clone and execute the sanitized Python audit tool in dry-run mode (no external web scraping queries are made by default):

```bash
# 1. Clone and enter the project directory
git clone [https://github.com/minerva-devs/tech-portfolio.git](https://github.com/minerva-devs/tech-portfolio.git)
cd tech-portfolio/projects/googled_myself

# 2. Configure the environment
cp .env.example .env
python -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
pip install -r requirements.txt

# 3. Run a safe dry-run test using sample inputs
python -m googled_myself.run_audit --config sample_inputs/config.yml --dry-run

# 4. Run unit tests
pytest -q
```
### ⚓ Project 2: Anchor Engine Node (Startup Memory Infrastructure)
Clone, install, and initialize our core semantic memory engine layer. This uses an explicit workspace filter to bypass root-level script limitations and boot up the server:

```bash
# 1. Clone and enter the repository
git clone [https://github.com/minerva-devs/anchor-engine-node.git](https://github.com/minerva-devs/anchor-engine-node.git)
cd anchor-engine-node

# 2. Install monorepo workspace dependencies
pnpm install

# 3. Target the sub-folder engine workspace and start the server on Port 3160
pnpm --filter engine start
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

## Anchor Engine Node — Co-Founder & Product Infrastructure
* **Purpose:** A deterministic, explainable, CPU‑only semantic memory layer utilizing a physics‑inspired graph algorithm (STAR) for long-term AI agent memory storage.
* **Architecture & Disconnect Resolution:** Successfully architected the system's runtime configurations to isolate application environments out of the root folder into secure user spaces (`$HOME/.anchor/`). Remediated broken build pipelines in the root execution layer by restructuring dependency resolution paths and setting up explicit workspace routing targets (`--filter`) to bind the core server engine directly to Port 3160.
* **Environment Controls:** Embedded robust data boundaries that shield internal configuration states while allowing configurable environment handling of API parameters via JSON-driven schema controls.

See full project README: /engine/README.md

---
