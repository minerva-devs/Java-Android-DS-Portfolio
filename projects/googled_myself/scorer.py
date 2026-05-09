import re
from typing import List, Dict, Tuple

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(
    r"\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b|\b555-0123\b"
)
NAME_RE = re.compile(r"\b[A-Z][a-z]{2,}\s[A-Z][a-z]{2,}\b")

DEFAULT_WEIGHTS = {"phone": 70, "email": 50, "name": 20}


def score_snippet(snippet: str, weights: Dict[str, int] | None = None) -> Tuple[int, List[Tuple[str, str]]]:
    weights = weights or DEFAULT_WEIGHTS
    matches: List[Tuple[str, str]] = []
    score = 0

    email_match = EMAIL_RE.search(snippet)
    if email_match:
        matches.append(("email", email_match.group()))
        score += weights.get("email", 50)

    phone_match = PHONE_RE.search(snippet)
    if phone_match:
        matches.append(("phone", phone_match.group()))
        score += weights.get("phone", 70)

    name_match = NAME_RE.search(snippet)
    if name_match:
        matches.append(("name", name_match.group()))
        score += weights.get("name", 20)

    return score, matches


def score_matches(parsed_pages: List[Dict], weights: Dict[str, int] | None = None) -> List[Dict]:
    weights = weights or DEFAULT_WEIGHTS
    results: List[Dict] = []

    for page in parsed_pages:
        total_score = 0
        all_matches: List[Dict] = []

        for snippet in page.get("snippets", []):
            s, m = score_snippet(snippet, weights=weights)
            total_score += s
            for t, v in m:
                all_matches.append({"type": t, "value": v})

        results.append(
            {
                "url": page.get("url"),
                "matches": all_matches,
                "risk_score": total_score,
            }
        )

    return results
