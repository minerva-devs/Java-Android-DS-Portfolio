# Logging Configuration Changes (2026-06-09)

## Problem Summary
The logger was creating **38,979 files** in `$HOME/.anchor/logs/` due to:
1. `maxSize: '10k'` — every 10KB triggered a rotation, creating hundreds of tiny files per day
2. Multiple PIDs logging to the same directory (8+ instances)
3. Log level set to `'debug'` — constant HTTP health-check pings filling up files
4. Duplicate error transport defined twice

## Solution Applied

### 1. Main Log File (`anchor_engine.log`)
- **Before:** `maxSize: '10k'`, `maxFiles: '7d'`
- **After:** `maxSize: '5m'`, `maxFiles: 5`
- **Result:** File grows to ~5MB before rotating; keeps exactly 5 files total

### 2. Error Log File (`anchor_engine_error.log`)
- **Before:** `maxSize: '10k'`, `maxFiles: '14d'`, duplicate transport
- **After:** `maxSize: '5m'`, `maxFiles: 5` (single instance)
- **Result:** Same behavior as main log, but only captures ERROR level

### 3. Log Level
- **Before:** `'debug'`
- **After:** `'info'`
- **Result:** Only INFO, WARN, ERROR logged — eliminates DEBUG/INFO health-check spam

### 4. Path Configuration
All paths are now defined in `user_settings.json.template` as the single source of truth:
```json
"paths": {
  "_description": "All user data routes to anchor_root.",
  "_note": "CRITICAL: All runtime paths (logs, DB, distills, sessions) are defined here and in ~/.anchor/user_settings.json. This is the single source of truth for path configuration.",
  "anchor_root": "<ANCHOR_ROOT>",
  "logs": "${anchor_root}/logs",
  ...
}
```

## Expected Result After Restart

- **2 log files max** (anchor_engine.log + anchor_engine_error.log)
- Each file grows to ~5MB before rotating
- Maximum of 5 rotated files kept per type = **10 total files**
- Logs are readable JSON with clear timestamps and levels
- No more 38K+ tiny 10KB files!

## Files Modified

1. `engine/src/utils/structured-logger.ts` — core logger configuration
2. `user_settings.json.template` — path definitions (single source of truth)
3. `engine/src/config/paths.ts` — path resolution with documentation
4. `engine/src/config/index.ts` — config loader priority explanation

## Cleanup Performed

Before restart, cleared:
- `$HOME/.anchor/logs/` (global logs directory)
- `coding_projects/anchor-engine-node/.anchor/` (project root runtime data)
- `coding_projects/anchor-engine-node/engine/.anchor/` (engine subdirectory)

All paths now route to centralized location per doc policy.