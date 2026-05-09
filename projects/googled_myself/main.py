# This is the orchestrator. It loads config + queries, runs the pipeline, and writes the report.


from pathlib import Path
from typing import List, Dict, Any

import yaml

from .fetcher import fetch_from_sources
from .parser import parse_html_snippets
from .scorer import score_matches
from .exporter import export_report


def load_config(path: str | Path) -> Dict[str, Any]:
    path = Path(path)
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def run_pipeline(
    config_path: str | Path = "sample_inputs/config.yml",
    dry_run: bool = True,
    live: bool = False,
) -> List[Dict]:
    cfg = load_config(config_path)
    queries = cfg.get("queries", [])
    weights = cfg.get("weights", {})
    serpapi_key = cfg.get("serpapi_key")

    raw_pages = fetch_from_sources(
        queries=queries,
        dry_run=dry_run,
        sample_html_dir=Path("sample_inputs/html"),
        live=live,
        serpapi_key=serpapi_key,
    )

    parsed = parse_html_snippets(raw_pages)
    scored = score_matches(parsed, weights=weights)

    out_dir = Path("sample_outputs")
    out_dir.mkdir(parents=True, exist_ok=True)

    export_report(
        scored,
        json_path=out_dir / "sample_report.json",
        csv_path=out_dir / "sample_report.csv",
        xlsx_path=out_dir / "sample_report.xlsx",
    )

    return scored
