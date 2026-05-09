from pathlib import Path

from googled_myself.parser import extract_text_snippets, parse_html_snippets


def test_extract_text_snippets_basic():
    html = "<html><body><p>Hello World</p><p>Second paragraph</p></body></html>"
    snippets = extract_text_snippets(html, max_snippets=2)
    assert len(snippets) == 2
    assert "Hello World" in snippets[0]


def test_parse_html_snippets_with_sample_file():
    sample_path = Path("sample_inputs/html/sample_1.html")
    html_text = sample_path.read_text(encoding="utf-8")
    raw_pages = [{"url": "file://sample_1.html", "text": html_text}]
    parsed = parse_html_snippets(raw_pages)
    assert len(parsed) == 1
    assert parsed[0]["url"] == "file://sample_1.html"
    assert len(parsed[0]["snippets"]) > 0