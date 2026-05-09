import json
import csv
from pathlib import Path
from typing import List, Dict

from openpyxl import Workbook


def export_report(
    results: List[Dict],
    json_path: Path,
    csv_path: Path,
    xlsx_path: Path,
) -> None:
    # JSON
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # CSV
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["URL", "Matches", "Risk Score"])
        for r in results:
            matches_str = "; ".join(f"{m['type']}={m['value']}" for m in r["matches"])
            writer.writerow([r["url"], matches_str, r["risk_score"]])

    # Excel
    wb = Workbook()
    ws = wb.active
    ws.append(["URL", "Matches", "Risk Score"])
    for r in results:
        matches_str = "; ".join(f"{m['type']}={m['value']}" for m in r["matches"])
        ws.append([r["url"], matches_str, r["risk_score"]])
    wb.save(xlsx_path)