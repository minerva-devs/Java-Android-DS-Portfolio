# Anchor Engine — Automated Testing Quick Reference

**Version:** 5.3.0 | **Updated:** June 13, 2026

---

## Quick Test Commands

```bash
# Run all tests (Vitest)
pnpm test

# Run integration tests
pnpm --filter anchor-engine test:vitest

# Run live-fire tests (requires running engine)
node engine/tests/live-fire/live-fire.mjs

# LLM autonomous testing workflow
# See docs/workflows/llm-testing.md for prompt template

# Run a specific test file
npx vitest run engine/tests/unit/paths-config.test.ts
```

## Test Categories

| Category | Location | Framework | Description |
|----------|----------|-----------|-------------|
| **Unit Tests** | `engine/tests/unit/` | Vitest | Core logic, utilities, config validation |
| **Integration Tests** | `engine/tests/integration/` | Vitest | End-to-end pipeline: search, ingest, distill |
| **Live-Fire Tests** | `engine/tests/live-fire/` | Node.js (ESM) | Real engine testing with live HTTP requests + live corpus verification |
| **E2E UI Tests** | `tests/e2e/` | Playwright + Vitest | Browser-based UI verification |

## Test Architecture

The three-tier testing strategy:

1. **Tier 1: Automated API Tests** — Vitest-based, run `pnpm test`. Covers all routes, services, and data integrity.
2. **Tier 2: Manual UI Testing** — Playwright for browser-based verification.
3. **Tier 3: Operational Verification** — Runtime health checks via `/health` endpoints.

## Prerequisites

- Node.js 18+ and PNPM
- Running engine on port 3160 (for live-fire and e2e tests):
  ```bash
  pnpm start
  ```

## See Also

- **[specs/current-standards/](specs/current-standards/)** — All 38 active standards (flat directory)
- **[specs/current-standards/034-unified-test-pipeline.md](specs/current-standards/034-unified-test-pipeline.md)** — Unified test pipeline standard
- **[specs/current-standards/018-mcp-integration-testing.md](specs/current-standards/018-mcp-integration-testing.md)** — MCP integration testing
- **[docs/workflows/llm-testing.md](docs/workflows/llm-testing.md)** — LLM autonomous testing workflow (prompt template for local models)
- **[engine/tests/](../engine/tests/)** — All test suites
