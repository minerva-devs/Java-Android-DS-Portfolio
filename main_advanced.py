import os
import asyncio
import aiohttp
import requests
import json
import csv
from bs4 import BeautifulSoup
from openpyxl import Workbook
from tkinter import Tk, Button, Text, END, Scrollbar, RIGHT, Y
from dotenv import load_dotenv

# ============================================================
# LOAD PERSONAL INFO FROM .env
# ============================================================

from pathlib import Path
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)


def parse_list(value):
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]

NAME = parse_list(os.getenv("NAME"))
EMAILS = parse_list(os.getenv("EMAILS"))
PHONE = parse_list(os.getenv("PHONE"))
SERPAPI_KEY = os.getenv("SERPAPI_KEY")

# ============================================================
# BUILD SEARCH QUERIES
# ============================================================

def build_queries():
    queries = []

    # General name/email/phone queries
    for n in NAME:
        queries.append(n)
        queries.append(f'"{n}" email')
        queries.append(f'"{n}" phone')

    for e in EMAILS:
        queries.append(f'"{e}"')

    for p in PHONE:
        queries.append(f'"{p}"')

    # Domain-specific filters
    domains = [
        "site:linkedin.com",
        "site:indeed.com",
        "site:glassdoor.com",
        "site:github.com",
        "site:facebook.com",
        "site:twitter.com",
        "site:instagram.com"
    ]

    for n in NAME:
        for d in domains:
            queries.append(f'{n} {d}')

    return queries

# ============================================================
# SERPAPI SEARCH
# ============================================================

def serpapi_search(query):
    url = "https://serpapi.com/search.json"
    params = {
        "q": query,
        "api_key": SERPAPI_KEY,
        "engine": "google"
    }
    try:
        r = requests.get(url, params=params, timeout=10)
        data = r.json()
        return [res["link"] for res in data.get("organic_results", [])]
    except:
        return []

# ============================================================
# ASYNC SCRAPING
# ============================================================

async def fetch(session, url):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        async with session.get(url, headers=headers, timeout=10) as resp:
            if resp.status != 200:
                return ""
            return await resp.text()
    except:
        return ""

async def async_scrape(urls):
    results = {}
    async with aiohttp.ClientSession() as session:
        tasks = [fetch(session, url) for url in urls]
        pages = await asyncio.gather(*tasks)

        for url, html in zip(urls, pages):
            results[url] = html
    return results

# ============================================================
# MATCH DETECTION
# ============================================================

def detect_matches(text):
    soup = BeautifulSoup(text, "html.parser")
    text = soup.get_text(" ", strip=True)

    matches = {
        "names": [],
        "emails": [],
        "phones": []
    }

    for n in NAME:
        if n.lower() in text.lower():
            matches["names"].append(n)

    for e in EMAILS:
        if e.lower() in text.lower():
            matches["emails"].append(e)

    for p in PHONE:
        if p in text:
            matches["phones"].append(p)

    return matches

# ============================================================
# RISK SCORING
# ============================================================

def risk_score(match):
    score = 0
    if match["emails"]:
        score += 50
    if match["phones"]:
        score += 70
    if match["names"]:
        score += 20
    return score

# ============================================================
# EXPORT FUNCTIONS
# ============================================================

def export_json(results):
    with open("audit_results.json", "w") as f:
        json.dump(results, f, indent=2)

def export_csv(results):
    with open("audit_results.csv", "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["URL", "Names", "Emails", "Phones", "Risk Score"])
        for r in results:
            writer.writerow([
                r["url"],
                ", ".join(r["matches"]["names"]),
                ", ".join(r["matches"]["emails"]),
                ", ".join(r["matches"]["phones"]),
                r["risk"]
            ])

def export_excel(results):
    wb = Workbook()
    ws = wb.active
    ws.append(["URL", "Names", "Emails", "Phones", "Risk Score"])

    for r in results:
        ws.append([
            r["url"],
            ", ".join(r["matches"]["names"]),
            ", ".join(r["matches"]["emails"]),
            ", ".join(r["matches"]["phones"]),
            r["risk"]
        ])

    wb.save("audit_results.xlsx")

# ============================================================
# MAIN AUDIT PIPELINE
# ============================================================

async def run_audit(log_callback):
    log_callback("Building queries...")
    queries = build_queries()

    log_callback("Collecting URLs from SerpAPI...")
    all_links = set()
    for q in queries:
        links = serpapi_search(q)
        all_links.update(links)

    urls = list(all_links)[:50]
    log_callback(f"Found {len(urls)} URLs to scan.")

    log_callback("Scraping pages asynchronously...")
    pages = await async_scrape(urls)

    results = []
    for url, html in pages.items():
        if not html:
            continue

        matches = detect_matches(html)
        if matches["names"] or matches["emails"] or matches["phones"]:
            r = {
                "url": url,
                "matches": matches,
                "risk": risk_score(matches)
            }
            results.append(r)
            log_callback(f"[MATCH] {url} (Risk {r['risk']})")

    log_callback("Exporting results...")
    export_json(results)
    export_csv(results)
    export_excel(results)

    log_callback("Done. Results saved.")
    return results

# ============================================================
# SIMPLE GUI
# ============================================================

class AuditGUI:
    def __init__(self):
        self.root = Tk()
        self.root.title("Personal Data Exposure Audit")

        self.text = Text(self.root, height=25, width=100)
        self.text.pack()

        scrollbar = Scrollbar(self.root)
        scrollbar.pack(side=RIGHT, fill=Y)
        self.text.config(yscrollcommand=scrollbar.set)
        scrollbar.config(command=self.text.yview)

        self.run_button = Button(self.root, text="Run Audit", command=self.start_audit)
        self.run_button.pack()

    def log(self, message):
        self.text.insert(END, message + "\n")
        self.text.see(END)

    def start_audit(self):
        asyncio.run(run_audit(self.log))

    def run(self):
        self.root.mainloop()

# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    gui = AuditGUI()
    gui.run()
