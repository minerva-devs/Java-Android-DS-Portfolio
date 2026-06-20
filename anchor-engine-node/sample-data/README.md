# Anchor Engine – Sample Data

This directory is watched by the Anchor Engine. Any text files placed here will be
automatically ingested, atomized, and made searchable.

## Quick Demo

Drop a `.txt`, `.md`, or `.yaml` file here and watch the terminal for ingestion logs:

```
[Watchdog] Detected add: inbox/your-file.md
[Atomizer] ⏱️ START: your-file.md
[AtomicIngest] ✅ COMPLETE: your-file.md in Xs
```

Then search via: `http://localhost:3160/search`
