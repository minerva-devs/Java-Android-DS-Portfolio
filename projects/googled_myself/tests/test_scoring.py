
from googled_myself.scorer import score_snippet, score_matches


def test_score_snippet_detects_email_phone_name():
    snippet = "Contact Alex Example at alex.example@examplemail.com or call 555-0123."
    score, matches = score_snippet(snippet)
    types = {m[0] for m in matches}
    assert "email" in types
    assert "phone" in types
    assert "name" in types
    assert score > 0


def test_score_matches_aggregates_scores():
    parsed = [
        {
            "url": "file://sample_1.html",
            "snippets": [
                "Contact Alex Example at alex.example@examplemail.com or call 555-0123."
            ],
        }
    ]
    results = score_matches(parsed)
    assert len(results) == 1
    assert results[0]["risk_score"] > 0
    assert results[0]["url"] == "file://sample_1.html"