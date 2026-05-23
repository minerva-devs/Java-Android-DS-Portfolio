# Core Libraries & References
# For googled_myself: Personal Data Exposure Tool
*A personal digital footprint async auditor; because apparently the internet remembers everything.*

## Async Programming

### asyncio
Official Python async framework used for:
- task scheduling
- concurrent execution
- async workflows

Docs:  
https://docs.python.org/3/library/asyncio.html

Used concepts:
- `async def`
- `await`
- `asyncio.gather()`

---

### aiohttp
Asynchronous HTTP client/server framework.

Docs:  
https://docs.aiohttp.org/en/stable/

Used for:
- concurrent web requests
- async scraping
- `ClientSession`

---

# HTTP Requests & Scraping

### requests
HTTP library for synchronous API calls.

Docs:  
https://requests.readthedocs.io/en/latest/

Used for:
- SerpAPI requests
- REST query handling

---

### BeautifulSoup4
HTML/XML parsing library.

Docs:  
https://www.crummy.com/software/BeautifulSoup/bs4/doc/

Used for:
- HTML parsing
- text extraction
- page normalization

Key method:
```python
soup.get_text(" ", strip=True)
```

---

# Environment Variables & Secrets

### python-dotenv
Loads environment variables from `.env`.

Docs:  
https://saurabh-kumar.com/python-dotenv/

Used for:
- API key management
- secure configuration loading

Key usage:
```python
load_dotenv(dotenv_path=env_path, override=True)
```

---

# Spreadsheet Export

### openpyxl
Excel workbook generation library.

Docs:  
https://openpyxl.readthedocs.io/en/stable/

Used for:
- `.xlsx` export
- workbook creation
- structured result storage

---

# GUI Framework

### tkinter
Built-in Python GUI toolkit.

Docs:  
https://docs.python.org/3/library/tkinter.html

Used for:
- desktop interface
- buttons
- logging/output display
- scrollable UI elements

---

# Search API

### SerpAPI
Search API used to retrieve indexed Google results without directly scraping search engine result pages.

Website:  
https://serpapi.com/

Docs:  
https://serpapi.com/search-api

Used for:
- search query execution
- organic result collection
- search automation

---

# Conceptual References

## Google Dorking / Query Expansion
Reference:  
https://owasp.org/www-community/attacks/Google_dorking

Used concepts:
- query expansion
- domain filtering
- indexed exposure discovery

Example:
```text
"Name" email
"Name" phone
site:linkedin.com Name
```

---

# Risk Scoring References

The risk scoring model in this project is heuristic and non-standardized.

Conceptual inspirations:
- privacy risk weighting
- OSINT exposure prioritization
- exposure triage systems

Related references:

### NIST Privacy Framework
https://www.nist.gov/privacy-framework

### FAIR Risk Framework
https://www.fairinstitute.org/fair-risk-management

### CVSS (conceptual similarity only)
https://www.first.org/cvss/

---

# Async & Pipeline Architecture References

## Real Python Async IO Guide
https://realpython.com/async-io-python/

Concepts used:
- async scraping
- concurrent request pipelines
- coroutine orchestration

---

# Security & Ethical References

## robots.txt Guidance
https://developers.google.com/search/docs/crawling-indexing/robots/intro

## EFF Web Scraping Overview
https://www.eff.org/issues/web-scraping

---

# Security Imperatives

## .env
Sensitive data should never be hardcoded.

Example:
```plaintext
SERPAPI_KEY=your_api_key
```

## .gitignore
Recommended exclusions:
```plaintext
.env
venv/
audit_results.*
```

Git ignore docs:  
https://git-scm.com/docs/gitignore