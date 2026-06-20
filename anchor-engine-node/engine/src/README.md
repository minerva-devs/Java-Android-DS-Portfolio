# Anchor Engine - Source Code Overview

**Version:** 5.3.0 | **Last Updated:** June 13, 2026

---

## Technology Stack

### Runtime & Database
- **Runtime:** Node.js (ES Modules)
- **Database:** PGlite (WASM-based PostgreSQL) - disposable index, zero persistence
- **Server:** Express.js

### Native Modules (Rust WASM) ⚡

Anchor Engine uses **Rust-compiled WebAssembly modules** for performance-critical operations. This eliminates the need for native compilation and provides universal platform support.

**Published Packages:**
| Package | Purpose | Version |
|---------|---------|--------|
| `@rbalchii/anchor-fingerprint-wasm` | Content fingerprinting (MD5, SHA256) | 1.0.0+ |
| `@rbalchii/anchor-atomizer-wasm` | Text atomization & entity extraction | 1.0.0+ |
| `@rbalchii/anchor-keyextract-wasm` | Key-value extraction from text | 1.0.0+ |
| `@rbalchii/anchor-tagwalker-wasm` | Semantic tag traversal | 1.0.0+ |

**Benefits:**
- ✅ Zero native compilation required (works on Windows ARM64, macOS, Linux)
- ✅ ~90% smaller binary size (~1.4MB WASM vs ~12MB C++ DLLs)
- ✅ 8x faster module loading (benchmarks: ~50ms vs ~400ms for native)
- ✅ Universal platform support (single .wasm file runs everywhere)

**Important:** The Rust WASM packages are **self-contained** - they don't require `npm install` after the initial setup. The package.json `assets` array ensures WASM files are copied to the correct locations during build/packaging. See [`../package.json`](../package.json) for the full assets configuration.

**Note:** The older C++ native modules (`engine/src/native/` directory) have been deprecated and removed in favor of these Rust WASM packages. If you encounter references to `koffi`, `node-addon-api`, or `cpp/` directories, those are legacy artifacts from the pre-WASM architecture.

### WASM Path Resolution & Troubleshooting

The WASM packages use **ESM module resolution** via `import.meta.resolve()` and are configured in [`../package.json`](../package.json) assets array:

```json
"assets": [
  ...
  "node_modules/@rbalchii/anchor-atomizer-wasm/**/*",
  "node_modules/@rbalchii/anchor-fingerprint-wasm/**/*",
  "node_modules/@rbalchii/anchor-keyextract-wasm/**/*",
  "node_modules/@rbalchii/anchor-tagwalker-wasm/**/*",
  ...
]
```

**Common Issues:**

1. **"WASM files not found during parsing"** - This occurs when the engine tries to load WASM modules before the `assets` are copied. **Solution:** Run `pnpm postinstall` or `npm run build:all` after installation to ensure assets are in place.

2. **Module loading fails on startup** - Check the logs. You should see:
   ```
   [WasmModuleLoader] ✓ anchor-atomizer-wasm loaded
   [WasmModuleLoader] All WASM modules loaded successfully
   ```
   If you see fallback warnings, WASM failed to load and JavaScript fallbacks are being used.

3. **Path resolution errors in production builds** - When using `pkg` or similar bundlers, ensure the `assets` array in `engine/package.json` is preserved. The bundler will copy WASM files to the output directory.

**Verify WASM Files Are Present:**
```bash
# Windows
ls node_modules/@rbalchii/anchor-atomizer-wasm/anchor_atomizer_bg.wasm

# Linux/Mac
ls -l node_modules/@rbalchii/anchor-atomizer-wasm/anchor_atomizer_bg.wasm
```

All four WASM packages should have a `.wasm` file in their respective `node_modules/@rbalchii/.../` directories.

### Dependencies

**Core:**
- `@electric-sql/pglite`: WASM PostgreSQL database
- `express`: Web server framework
- `zod`: Runtime validation schemas
- `winston-daily-rotate-file`: Structured logging

**NLP & Search:**
- `wink-nlp`, `wink-eng-lite-web-model`: Named entity recognition, text processing
- Custom STAR algorithm implementation (physics-inspired graph traversal)

**Utilities:**
- `uuid`: Unique identifiers
- `chokidar`: File system watching
- `tar`: Archive handling

---

## Directory Structure

```
engine/src/
├── index.ts                    # Entry point, server startup
├── config/                     # Configuration management
│   ├── index.ts               # Config loader (Zod validation)
│   ├── paths.ts               # Path management
│   ├── encryption-config.ts   # Encryption settings
│   ├── max-recall-config.ts   # Max-recall mode settings
│   └── known-entities.ts      # Known entity mappings
│
├── core/                       # Core functionality
│   ├── db.ts                  # PGlite database layer
│   ├── batch.ts               # Batch processing
│   ├── provenance-utils.ts    # Provenance tracking utilities
│   ├── schema-migration.sql   # Database schema migration
│   └── inference/             # LLM inference (optional)
│
├── services/                   # Business logic
│   ├── ingest/                # Content ingestion
│   │   ├── atomizer-service.ts
│   │   ├── ingest.ts
│   │   ├── ingest-atomic.ts
│   │   ├── github-ingest-service.ts
│   │   ├── streaming-ingest.ts
│   │   └── watchdog.ts        # File watcher
│   │
│   ├── search/                # Search & retrieval
│   │   ├── search.ts          # STAR algorithm
│   │   ├── context-inflator.ts
│   │   ├── explore.ts
│   │   └── ...
│   │
│   ├── distillation/          # Knowledge compression
│   │   ├── radial-distiller.ts
│   │   └── radial-distiller-v2.ts
│   │
│   ├── tags/                  # Tag management
│   │   ├── tag-auditor.ts
│   │   ├── infector.ts
│   │   └── discovery.ts
│   │
│   └── ...
│
├── routes/                     # HTTP API endpoints
│   ├── v1/
│   │   ├── memory.ts          # Search, explore, distill
│   │   ├── ingest.ts          # Ingestion endpoints
│   │   ├── search.ts          # Search endpoints
│   │   ├── tags.ts            # Tag endpoints
│   │   ├── backup.ts          # Phoenix Protocol
│   │   ├── system.ts          # System endpoints
│   │   └── ...
│   └── ...
│
├── middleware/                 # Express middleware
│   ├── auth.ts                # API key auth
│   ├── validate.ts            # Request validation
│   └── request-tracing.ts     # Request tracing
│
├── schemas/                    # Zod schemas
│   └── api-schemas.ts         # API validation schemas
│
├── types/                      # TypeScript types
│   ├── atomic.ts              # Atom/molecule types
│   ├── search.ts              # Search types
│   └── ...
│
├── utils/                      # Utilities
│   ├── path-manager.ts        # Path management
│   ├── structured-logger.ts   # Logging
│   ├── timer.ts               # Timing utilities
│   └── ...
│
└── tests/                      # Unit tests
    ├── ingest.test.ts
    ├── search.test.ts
    └── distill.test.ts
```

---

## Key Entry Points

### Server Startup (`index.ts`)

```typescript
// Main entry point
import { startServer } from './core/db';
import { setupRoutes } from './routes';

async function main() {
  await startServer();
  setupRoutes();
  console.log('Anchor Engine running on port 3160');
}

main();
```

**Startup Sequence:**
1. Load configuration
2. Initialize PGlite database
3. Setup Express routes
4. Start watchdog service
5. Begin accepting requests

---

## Core Modules

### Database Layer (`core/db.ts`)

**Purpose:** PGlite database initialization and management

**Key Functions:**
- `init()` - Database initialization
- `run()` - Execute SQL queries
- `reset()` - Wipe and rebuild database

**Example:**
```typescript
import { db } from './core/db';

const results = await db.run(
  'SELECT * FROM atoms WHERE id = ?',
  [atomId]
);
```

---

### Configuration (`config/`)

**Purpose:** Load and validate configuration

**Key Files:**
- `index.ts` - Config loader
- `paths.ts` - Path resolution
- `schema.ts` - Zod validation

**Example:**
```typescript
import { config } from './config';

const maxChars = config.SEARCH.max_chars_default;
```

---

## Services

### Ingestion (`services/ingest/`)

**Purpose:** Ingest content into knowledge graph

**Key Modules:**
- `atomizer-service.ts` - Split content into atoms
- `ingest.ts` - Main ingestion logic
- `watchdog.ts` - File system watcher

**Flow:**
```
File → Mirror → Atomize → Tag → Store
```

---

### Search (`services/search/`)

**Purpose:** Retrieve relevant context using STAR algorithm

**Key Modules:**
- `search.ts` - Main search implementation
- `context-inflator.ts` - Expand context windows
- `explore.ts` - BFS graph traversal

**Algorithm:**
```
Query → Tags → Anchor Atoms → Walk Graph → Rank → Return
```

---

### Distillation (`services/distillation/`)

**Purpose:** Compress knowledge into decision records

**Key Modules:**
- `radial-distiller.ts` - v1 (line-level)
- `radial-distiller-v2.ts` - v2 (Decision Records)

**Output:**
```json
{
  "records": [...],
  "session_index": [...],
  "digital_objects": [...]
}
```

---

## Routes

### Memory Routes (`routes/v1/memory.ts`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/search` | POST | Semantic search |
| `/explore` | POST | Graph exploration |
| `/distill` | POST | Radial distillation |

### Ingest Routes (`routes/v1/ingest.ts`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | POST | Ingest text |
| `/streaming` | POST | Stream large files |

---

## Testing

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Specific test file
npx vitest run src/services/search/search.test.ts
```

### Test Structure

```typescript
describe('STAR Search', () => {
  it('returns relevant results', async () => {
    const results = await search({ query: 'test' });
    expect(results.length).toBeGreaterThan(0);
  });
});
```

---

## Philosophy Alignment

This source tree embodies the core principles:

| Principle | Implementation |
|-----------|----------------|
| **Forgetting** | `radial-distiller-v2.ts` removes redundancy |
| **Relationships** | `search.ts` walks graph edges |
| **Efficiency** | `core/db.ts` pointer-only index |
| **Clarity** | `distillation/` extracts Decision Records |
| **Explainability** | All routes return provenance |

---

## Contributing

### Adding New Features

1. **Service Layer:** Add business logic in `services/`
2. **Routes:** Add API endpoints in `routes/v1/`
3. **Schemas:** Add validation in `schemas/`
4. **Tests:** Add tests in corresponding `.test.ts` files

### Code Style

- TypeScript strict mode
- ESLint rules enforced
- Prettier formatting
- Zod validation for all inputs

---

## Support

- **API Docs:** [`specs/spec.md#api-endpoints`](../../specs/spec.md#api-endpoints)
- **Standards:** [`specs/current-standards/`](../../specs/current-standards/)
- **Issues:** https://github.com/RSBalchII/anchor-engine-node/issues
