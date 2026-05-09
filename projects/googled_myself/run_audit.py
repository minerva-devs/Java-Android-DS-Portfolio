# CLI wrapper(entrypoint)
#!/usr/bin/env python3
"""
Entry point wrapper. Default is --dry-run (safe). To run live you must pass --confirm-live
and set SERPAPI_KEY in a .env file or config.
"""
import argparse
import os

from dotenv import load_dotenv

from googled_myself.main import run_pipeline

load_dotenv()


def parse_args():
    p = argparse.ArgumentParser(description="Googled_Myself demo runner")
    p.add_argument(
        "--config",
        "-c",
        default="sample_inputs/config.yml",
        help="Path to config YAML",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Process local sample inputs only (default, safe)",
    )
    p.add_argument(
        "--confirm-live",
        action="store_true",
        help="Allow live queries via SerpAPI (requires SERPAPI_KEY)",
    )
    return p.parse_args()


def main():
    args = parse_args()

    live = False
    serpapi_key = os.getenv("SERPAPI_KEY")

    if args.confirm_live:
        if not serpapi_key:
            raise SystemExit("SERPAPI_KEY missing in environment. Aborting live run.")
        live = True

    if not args.dry_run and not args.confirm_live:
        print("No mode specified: defaulting to dry-run for safety.")
        args.dry_run = True

    run_pipeline(config_path=args.config, dry_run=args.dry_run, live=live)


if __name__ == "__main__":
    main()
