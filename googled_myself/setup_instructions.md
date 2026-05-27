# Googled Myself: Personal OSINT Audit Tool

## A. Setup

1. **Create the project folder:**
   ```bash
   mkdir -p tech-portfolio/googled_myself/
   cd tech-portfolio/googled_myself/

```

2. **Create a `.env` file** in the `googled_myself/` directory:
```env
NAME=Your Name
EMAILS=you@example.com
PHONE=555-123-4567
SERPAPI_KEY=your_serpapi_key_here

```


3. **Install the required dependencies** in your virtual environment (`venv`):
```bash
pip install aiohttp requests beautifulsoup4 python-dotenv openpyxl

```

---

## B. Program Flow

The application executes through the following stages:

* **Load Configuration:** Reads the `.env` file and parses `NAME`, `EMAILS`, and `PHONE` into Python lists.
* **Build Search Queries:** Combines target identifiers (names, emails, phones) into optimized Google search strings.
* **Call SerpAPI:** Requests Google search results for each query and aggregates a list of unique target URLs.
* **Scrape Pages (Async):** Utilizes parallel processing to asynchronously download the raw HTML for each discovered URL.
* **Analyze Content:** * Strips HTML tags to extract raw text.
* Scans for instances of the configured names, emails, and phone numbers.
* Computes a relative privacy risk score for each page.


* **Save Results:** Exports findings to `JSON`/`CSV`/`Excel` (Full GUI version) or `JSON` only (Minimal CLI version).
* **Progress Tracking:** Displays real-time updates via the GUI window or directly to the terminal console.

---

## B. Running the GUI Version

1. Open a terminal in the project folder and ensure your virtual environment is active.
2. Launch the advanced interface:
```bash
python googled_myself/main_advanced.py

```


3. In the application window, click **"Run Audit"**.
4. Monitor progress via the live log messages.
5. Once complete, review the generated report files in your project directory:
* `audit_results.json`
* `audit_results.csv`
* `audit_results.xlsx`

---

## C. Running the Minimal CLI Version (No GUI)

1. Open a terminal in the project folder and ensure your virtual environment is active.
2. Execute the lightweight script:
```bash
python googled_myself/minimal_audit.py

```


3. **Inspect Output:** Monitor real-time progress via the terminal console logs. Upon completion, parse or view the exported data file:
* `audit_results.json`



```

```
## D. Program Flow

The application executes through the following stages:

* **Load Configuration:** Reads the `.env` file and parses `NAME`, `EMAILS`, and `PHONE` into Python lists.
* **Build Search Queries:** Combines target identifiers (names, emails, phones) into optimized Google search strings.
* **Call SerpAPI:** Requests Google search results for each query and aggregates a list of unique target URLs.
* **Scrape Pages (Async):** Utilizes parallel processing to asynchronously download the raw HTML for each discovered URL.
* **Analyze Content:** * Strips HTML tags to extract raw text.
* Scans for instances of the configured names, emails, and phone numbers.
* Computes a relative privacy risk score for each page.


* **Save Results:** Exports findings to `JSON`/`CSV`/`Excel` (Full GUI version) or `JSON` only (Minimal CLI version).
* **Progress Tracking:** Displays real-time updates via the GUI window or directly to the terminal console.

```

```