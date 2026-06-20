# In-Use Workflow

## Current Manual Workflow

This document describes the current, manually-driven workflow for using Anchor Engine. It is designed to be explicit and self-documenting.

---

### Step 1: Start the Engine

```bash
cd C:\Users\rsbii\.qwenpaw\workspaces\P1\coding_projects\anchor-engine-node
pnpm start
```

The engine will automatically:
- Initialize PGlite database (wipes `~/.anchor/context_data/` if configured)
- Create necessary directories under `~/.anchor/`
- Start HTTP server on port 3160

### Step 2: Open the GUI

Either:
- Double-click your project folder in File Explorer → Opens in VS Code (if configured)
- Or navigate to `http://localhost:3160/search` in a browser

The default search page shows:
- Database status (healthy/unhealthy, atom/molecule counts)
- Utility buttons (Search, Paths, Web Research, GitHub Ingestion, Settings, Test Suite)

### Step 3: Configure Your Project Path

1. Click the **Paths** button
2. You'll see a text area labeled "Add path" or similar
3. Copy your project folder path (e.g., `C:\Users\rsbii\.qwenpaw\workspaces\P1\coding_projects\myproject`)
4. Paste into the text area and click **Add Path**

This adds your directory to the watch list for the ingestion service.

### Step 4: Start Ingestion (Watchdog)

From the search page or settings UI, start the Watchdog service:

- This service continuously monitors watched directories
- When files change, it triggers ingestion → indexing → distillation
- Status is visible in real-time

**Note:** The default directories (`notebook/` and `context/`) are empty on startup. You must add your project path manually as described above.

### Step 5: Verify Ingestion

After starting the watchdog:
1. Watch the progress indicator (shows percentage)
2. Check `/v1/stats` or the UI for updated atom/molecule counts
3. Once complete, run a search to verify retrieval works

---

## Data Flow Summary

```
Project Files → Watchdog Service → Ingestion API → Database (PGlite)
                                              ↓
                                         Mirror Brain (filesystem cache)
                                              ↓
                                        Distillation Pipeline
                                              ↓
                                    YAML Corpus Backup (with provenance)
```

---

## Known Gaps in Current Workflow

### Manual Steps Required
- Adding project paths to the watch list
- Starting the watchdog manually
- Running backup operations (no auto-backup yet)

### Missing Automation
- Browser doesn't auto-open on launch
- No automatic path detection from VS Code workspace
- Corpus backups must be initiated manually via GUI button or API

### Data Loss Scenarios
If `~/.anchor/` is cleared:
1. Database is wiped (ephemeral by design)
2. Mirror brain files are lost
3. Must re-run ingestion to rebuild everything

**Mitigation:** Use the YAML corpus backup feature before clearing any data.

---

## Troubleshooting

### "Database Empty" Warning
The database was just cleared. Run ingestion again:
1. Ensure your project path is added
2. Start/Restart the watchdog
3. Wait for completion (watch progress indicator)

### Port 3160 Already in Use
```bash
# Windows
netstat -ano | findstr :3160
taskkill /PID <PID> /F

# Or change port via config
```

### Backup Location
Backups are written to: `~/.anchor/distills/` or `~/.anchor/backups/` depending on configuration.

To restore from backup, use the GUI "Restore" feature (coming soon) or API endpoint `/v1/backups/restore`.

---

## LLM Developer Testing

For LLM agents (local or hosted models like Qwen 3.6 27B) that need to autonomously test Anchor Engine, see the self-contained testing workflow:

→ **[docs/workflows/llm-testing.md](llm-testing.md)**

This document includes:
- A copy-paste prompt template to direct an LLM through all 5 test phases
- Expected output formats for each phase
- Structured report template for the LLM to fill in
- Common failure patterns and troubleshooting
- Live corpus integration (reads `~/.anchor/user_settings.json` for real data paths)

### Quick LLM Testing Commands

```bash
# Full automated test suite (LLM-parseable output)
node engine/tests/live-fire/live-fire.mjs

# Read results
cat engine/tests/live-fire/live-fire.log
cat engine/tests/live-fire/results.json | jq '.passed, .failed, .total'

# Density prefix tests (3-tier RAG pipeline)
curl -s -X POST http://localhost:3160/v1/memory/search \
  -H "Content-Type: application/json" \
  -d '{"query":"density:contract"}' | jq '.density_tier'
```