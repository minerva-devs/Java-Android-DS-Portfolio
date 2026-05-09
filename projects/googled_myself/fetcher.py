# Demo fetcher


import asyncio
from pathlib import Path
from typing import List, Dict, Optional

import aiohttp
import requests


def serpapi_search(query: str, api_key: str) -> List[str]:
    """
    Use SerpAPI to fetch links for a given query.
    Live mode only; not used in dry-run.
    """
    url = "https://serpapi.com/search.json"
    params = {
        "q": query,
        "api_key": api_key,
        "engine": "google",
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return [res["link"] for res in data.get("organic_results", [])]
    except Exception:
        return []


async def _fetch_http(session: aiohttp.ClientSession, url: str) -> Dict:
    try:
        headers = {"User-Agent": "GoogledMyselfDemo/0.1 (+https://github.com/minerva-devs)"}
        async with session.get(url, headers=headers, timeout=15) as resp:
            if resp.status != 200:
                return {"url": url, "text": ""}
            text = await resp.text()
            return {"url": url, "text": text}
    except Exception:
        return {"url": url, "text": ""}


async def _fetch_local(path: Path) -> Dict:
    return {"url": f"file://{path.name}", "text": path.read_text(encoding="utf-8")}


async def _gather_http(urls: List[str]) -> List[Dict]:
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        tasks = [_fetch_http(session, u) for u in urls]
        return await asyncio.gather(*tasks)


def fetch_from_sources(
    queries: List[str],
    dry_run: bool = True,
    sample_html_dir: Path = Path("sample_inputs/html"),
    live: bool = False,
    serpapi_key: Optional[str] = None,
) -> List[Dict]:
    """
    In dry-run mode:
      - Map queries to local sample HTML files (sample_1.html, sample_2.html, ...).
    In live mode:
      - Use SerpAPI to get URLs, then scrape them asynchronously.
    """
    if dry_run:
        results: List[Dict] = []
        for i, _ in enumerate(queries):
            local = sample_html_dir / f"sample_{i + 1}.html"
            if local.exists():
                results.append(asyncio.run(_fetch_local(local)))
        return results

    # Live mode
    if not live:
        # Safety: if not explicitly live, treat as dry-run
        return fetch_from_sources(queries, dry_run=True, sample_html_dir=sample_html_dir)

    if not serpapi_key:
        raise ValueError("serpapi_key is required for live mode.")

    urls: List[str] = []
    for q in queries:
        urls.extend(serpapi_search(q, serpapi_key))

    # Deduplicate and limit
    urls = list(dict.fromkeys(urls))[:50]

    if not urls:
        return []

    pages = asyncio.run(_gather_http(urls))
    return pages
