# Standard 011: Security Hardening

**Status:** Active
**Date:** 2026-03-22
**Supersedes:** N/A

## Context
Anchor Engine exposes HTTP APIs and MCP tools that may contain sensitive data. Security vulnerabilities were discovered including hardcoded default credentials and path traversal risks.

## Pain Points Fixed
- Commit `035ce82`: Hardcoded default API key `ece-secret-key` allowed unauthorized access
- Commit `7ef1bd1`: Path traversal vulnerability in `/v1/system/paths`
- Commit `7ef1bd1`: No rate limiting on ingestion endpoints

## Requirements

### SEC-001: No Default Credentials
1. Never ship hardcoded API keys, passwords, or secrets in source code
2. Engine must fail to start with clear error message if authentication is not configured
3. Example error: `Error: API key required. Set server.api_key in user_settings.json`

```typescript
// ✅ CORRECT: Fail fast with clear message
if (!config.server.api_key) {
  console.error('API key required. Set server.api_key in user_settings.json');
  process.exit(1);
}

// ❌ WRONG: Silent fallback to insecure default
const apiKey = config.server.api_key || 'default-key';
```

### SEC-002: Path Validation
1. All path inputs must be validated as absolute paths
2. Check path exists and is readable before accepting
3. Warn when adding paths outside PROJECT_ROOT
4. Return `within_project_root` boolean flag in responses

```typescript
// ✅ CORRECT: Validate before accepting
const resolvedPath = path.resolve(inputPath);
if (!path.isAbsolute(resolvedPath)) {
  return res.status(400).json({ error: 'Absolute path required' });
}
if (!fs.existsSync(resolvedPath)) {
  return res.status(400).json({ error: 'Path does not exist' });
}

// ❌ WRONG: Accept any input (path traversal vulnerability)
const watchPath = req.body.path;
```

### SEC-003: Rate Limiting
1. Ingestion endpoints must have rate limiting
2. Default: 10 requests/minute for ingest (mobile-friendly)
3. Skip rate limiting for localhost in development mode
4. Return `retry-after` header on rate limit exceeded

## Implementation Notes
- Auth middleware in `engine/src/middleware/auth.ts`
- Path validation in `engine/src/routes/v1/settings.ts`
- Rate limiting via `express-rate-limit` package# Security Update Plan: 206 CodeQL Alerts

## Executive Summary
- **Total alerts:** 206 (15 critical, 52 high, 77 moderate, 2 low)
- **Priority:** Address critical/high severity first
- **Timeline:** Phase approach over 4 weeks

---

## 🔴 Critical Priority (Week 1)

### 1. SSRF in github-ingest-service.ts (#37)
**File:** `engine/src/services/ingest/github-ingest-service.ts:769`
**Issue:** Unvalidated URL fetch to GitHub API
```typescript
// Current (vulnerable):
const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}...`

// Fix: Validate owner/repo/branch format before fetching
```

### 2. Axios Vulnerabilities (#242, #240, #238, #236, #234, #232)
**Files:** `pnpm-lock.yaml`, `engine/pnpm-lock.yaml`
**Issues:** 
- Header injection chain (unrestricted cloud metadata exfiltration)
- NO_PROXY hostname normalization bypass → SSRF

**Action:** Upgrade axios to `1.7.9+` or later

### 3. Handlebars.js AST Type Confusion (#165, #70)
**Files:** `pnpm-lock.yaml`, `engine/pnpm-lock.yaml`
**Issues:** JavaScript injection via tampering @partial-block and dynamic partials

**Action:** Upgrade handlebars to `4.8.0+` or later

---

## 🟡 High Priority (Week 2-3)

### 4. Vite fs.deny Bypass (#186, #185, #182, #181)
**Files:** Multiple package-lock files
**Issue:** `server.fs.deny` bypassed with queries
**Action:** Upgrade vite to latest patch version

### 5. Path Traversal Issues
**Files:** 
- `radial-distiller-v2.ts:1240,1263,1289,1315` (#98-#101)
- `test-ui.ts:355,399,587,591` (#93-#96)

**Action:** Add path sanitization using `path.normalize()` + prefix check

### 6. Rate Limiting Missing (#70, #71, #38, #39, #10)
**Files:** 
- `engine/src/index.ts:161,174`
- `scripts/benchmarks/settings_concurrency_benchmark.js:25,36`
- `engine/public/monitoring.ts:18`

**Action:** Implement rate limiting middleware for API endpoints

### 7. Regex Injection (ReDoS)
**Files:**
- `picomatch` (#129, #123, #87, etc.)
- `minimatch` (#147, #146, #145, etc.)
- `path-to-regexp` (#171, #170, #172)

**Action:** Upgrade to patched versions with bounded quantifiers

### 8. Loop Bound Injection (#107, #47, #72)
**Files:** 
- `search-results-logger.ts:59`
- `adaptive-concurrency.ts:246`
- `atomizer-service.ts:1247`

**Action:** Validate loop bounds before execution

---

## 🟢 Medium Priority (Week 4)

### 9. Format String Issues (#97, #73, #6, #7)
**Files:** Multiple services
**Issue:** Externally-controlled format strings

### 10. Incomplete Escaping (#105, #104, #88, #87, #86, #15, #14)
**Files:** HTML templates, content-cleaner.ts, export.ts

### 11. Path Traversal in Backup (#23-#26, #66-#68, #74-#77)
**Files:** backup.ts, backup-restore.ts, graph-export.ts, encryption.ts

---

## 📦 Action Items

### Immediate Actions (Today)
1. ✅ Fix SSRF in github-ingest-service.ts
2. ⏳ Upgrade axios to 1.7.9+
3. ⏳ Upgrade handlebars to 4.8.0+

### Short-Term (This Week)
4. Add path sanitization in distiller and test-ui
5. Implement rate limiting middleware
6. Fix loop bound validation

### Medium-Term (Next Week)
7. Upgrade vite, picomatch, minimatch, tar, simple-git
8. Fix format string issues
9. Address remaining escaping issues

---

## 📋 Verification Checklist

After updates:
- [ ] Run `npm audit` to verify no critical/high alerts remain
- [ ] Re-run CodeQL scan on main branch
- [ ] Update pnpm-lock.yaml in all locations
- [ ] Document changes in CHANGELOG.md
- [ ] Create PR for review

---

## 📝 Dependencies Upgrade Matrix

| Package | Current Version | Target Version | Alert Count | Priority |
|---------|----------------|----------------|-------------|----------|
| axios | 1.7.x | 1.7.9+ | 6 | 🔴 Critical |
| handlebars | 4.7.x | 4.8.0+ | 12+ | 🔴 Critical |
| vite | latest | patch | 8+ | 🟡 High |
| picomatch | latest | patched | 8+ | 🟡 High |
| minimatch | latest | patched | 6+ | 🟡 High |
| path-to-regexp | latest | patched | 10+ | 🟡 High |
| tar/node-tar | latest | patched | 8+ | 🟡 High |
| simple-git | latest | patched | 1 | 🟢 Medium |

---

## 🔍 Notes
- PR #141 (Security Hardening) already merged - these are additional alerts from CodeQL
- Some alerts may be false positives (Test designation)
- Focus on production code first, then tests/benchmarks
