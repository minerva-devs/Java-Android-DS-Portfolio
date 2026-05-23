# googled_myself
*A personal digital footprint async auditor; because apparently the internet remembers everything.*

## Project Purpose
**googled_myself: Personal Data Exposure Tool** was created as an exploration into digital footprint awareness and privacy-oriented OSINT (Open Source Intelligence). In an era where exposed personal identifiers contribute to phishing, social engineering, and identity theft, this tool acts as a diagnostic utility to help individuals monitor their publicly indexed web content.

### Why Digital Hygiene Matters
Most users underestimate their "unwanted discoverability." Exposed data on indexed archives, old resumes, or forgotten social media profiles can lead to:
* **Credential Stuffing & Phishing:** Targeted attacks using known emails.
* **Privacy Erosion:** Cross-referencing disparate data points to build a full profile.
* **Operational Security (OpSec):** Identifying leaks before they can be exploited.

---

## Tech Stack
* **Language:** Python 3.x
* **Editor:** Visual Studio Code (VS Code)
* **Environment:** Python Virtual Environment (`.venv`).
    * **Why:** This ensures project dependencies (like `aiohttp` and `BeautifulSoup`) are isolated from the global system, preventing version conflicts and ensuring the code runs reliably on any machine.
* **Key Libraries:** * `asyncio` & `aiohttp`: Used for high-speed asynchronous web scraping.
    * `BeautifulSoup4`: For parsing HTML content.
    * `Tkinter`: To provide a simple, user-friendly GUI.
    * `openpyxl`, `csv`, `json`: For generating multi-format audit reports.

---

## Architectural Patterns
The project implements several sophisticated software design patterns:
* **Pipeline Pattern:** Follows a strict sequential flow: Query Expansion → URL Retrieval → Async Scraping → Text Parsing → Match Detection → Risk Scoring → Export.
* **Concurrent Worker Pattern:** Leverages `asyncio` to fetch multiple pages simultaneously rather than sequentially, significantly reducing audit time.
* **Lightweight ETL Workflow:** Operates as a classic **Extract** (HTML collection), **Transform** (normalization), and **Load** (structured export) process.

---

## Risk Scoring Heuristics
The tool uses a non-standardized heuristic model to prioritize exposures. It is conceptually inspired by exposure triage systems rather than rigid frameworks like NIST or CVSS.

| Identifier | Weight | Rationale |
| :--- | :--- | :--- |
| **Phone Match** | **+70** | Highly sensitive; primary vector for 2FA bypass and SMS phishing. |
| **Email Match** | **+50** | Moderate/High risk; primary account identifier. |
| **Name Match** | **+20** | Lower risk; often public, but adds context to other leaks. |

---

## API Usage & Limitations

### SerpAPI Integration
This project uses **SerpAPI** to interface with Google Search results without being blocked by anti-bot measures.
* **Quota:** The free tier typically allows 100–250 searches/month.
* **Per-Run Consumption:** Based on the current code logic (processing names, emails, and phone numbers across 7 domains), a single comprehensive run utilizes approximately **25–30 unique search queries**. 
* **Scalability:** For users requiring frequent or massive audits, a paid subscription is necessary to handle the exponentially higher search volume required for deep-web scanning.

### Search Coverage
This tool detects publicly indexed content only. It cannot access:
* Dark web leaks (use services like *Have I Been Pwned*).
* Authenticated or private social media content.
* Non-indexed datasets or "Deep Web" records.

---

## Setup & Security
1. **Environment:** Create a `.env` file based on the provided `.env.example`.
2. **API Key:** Add your `SERPAPI_KEY` and personal identifiers.
3. **Security Imperative:** The `.gitignore` is pre-configured to ensure `.env`, `venv/`, and your personal `audit_results` are **never** committed to version control.
4. **Execution:** Run `run_audit.bat` to launch the audit interface.

---

## Ethical Use
This tool is intended for personal auditing and educational use only. Users must respect `robots.txt` policies, comply with platform Terms of Service, and avoid targeting third parties without explicit permission.