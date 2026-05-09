# Extracts structured data from HTML.

from typing import List, Dict
from bs4 import BeautifulSoup


def extract_text_snippets(html_text: str, max_snippets: int = 5) -> List[str]:
    soup = BeautifulSoup(html_text or "", "html.parser")
    texts: List[str] = []
    for tag in soup.find_all(["p", "li", "span"], limit=50):
        t = tag.get_text(separator=" ", strip=True)
        if t:
            texts.append(t)
            if len(texts) >= max_snippets:
                break
    return texts


def parse_html_snippets(raw_pages: List[Dict]) -> List[Dict]:
    parsed: List[Dict] = []
    for page in raw_pages:
        snippets = extract_text_snippets(page.get("text", ""), max_snippets=8)
        parsed.append(
            {
                "url": page.get("url"),
                "snippets": snippets,
            }
        )
    return parsed
