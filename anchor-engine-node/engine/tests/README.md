# A+B Testing Framework

Comprehensive testing suite for Anchor Engine integrations and packages.

## Test Suites

### 1. API Client Tests (`packages/api-client/test/`)

**Purpose:** Test the TypeScript API client library

**Capabilities Tested:**
- **A: Basic Operations**
  - Search with query
  - Text ingestion
  - Simple distillation
  
- **B: Advanced Operations**
  - Filtered search (buckets, scores)
  - File reading with line ranges
  - Graph illumination
  - Pagination handling

**Run:**
```bash
cd packages/api-client
pnpm test
pnpm test:coverage
pnpm test:watch
```

### 2. Web Dashboard Tests (`integrations/web-dashboard/src/**/*.test.tsx`)

**Purpose:** Test React components for the web UI

**Capabilities Tested:**
- **A: Core Features**
  - Search page functionality
  - Basic text ingestion
  - Result display
  
- **B: Advanced Features**
  - Advanced search filters
  - File upload/drop
  - Metadata display
  - Paste & Ingest (v5.0.0)

**Run:**
```bash
cd integrations/web-dashboard
pnpm test
pnpm test:component
pnpm test:coverage
```

### 3. End-to-End Tests (`tests/e2e/`)

**Purpose:** Full integration testing with running engine

**Capabilities Tested:**
- **A→B: Complete Workflows**
  - Ingest → Search → Distill → Illuminate
  - List → Read → Search
  - Data persistence
  
- **Performance Benchmarks**
  - Search latency (<200ms p95)
  - Concurrent request handling
  - Memory efficiency

**Requirements:**
- Running Anchor Engine instance on `localhost:3160`

**Run:**
```bash
# Start engine first
pnpm start

# In another terminal
pnpm test:e2e
```

## Test Runner

Unified test runner for all suites:

```bash
# Run all tests
pnpm test:runner

# Run specific suite
pnpm test:runner client
pnpm test:runner dashboard
pnpm test:runner e2e

# Run with coverage
pnpm test:coverage
```

## Test Organization

### A Tests (Basic/Core)
- Simple search
- Text ingestion
- Basic result display
- Single operations
- Unit tests

### B Tests (Advanced/Extended)
- Filtered search
- File operations
- Advanced UI features
- Complex workflows
- Integration tests

## Coverage Reports

HTML coverage reports generated in:
- `packages/api-client/coverage/`
- `integrations/web-dashboard/coverage/`
- `coverage/` (root, for E2E)

View in browser:
```bash
open packages/api-client/coverage/index.html
open integrations/web-dashboard/coverage/index.html
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pre-publish (`prepublishOnly`)
- Nightly builds

### GitHub Actions Workflow

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:runner
```

## Mocking Strategy

### API Client Tests
- Mock HTTP responses
- Simulate network delays
- Test error scenarios

### Dashboard Tests
- Mock `@rbalchii/anchor-client`
- Simulate user interactions
- Test component state

### E2E Tests
- Real engine instance
- Real API calls
- Real file system

## Environment Variables

```bash
# Engine URL (default: http://localhost:3160)
ANCHOR_API_URL=http://localhost:3160

# API key (if authentication enabled)
ANCHOR_API_KEY=your-api-key

# Test timeout (default: 30000ms)
TEST_TIMEOUT=60000
```

## Writing New Tests

### API Client Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { AnchorClient } from '../src/index';

describe('Feature Name', () => {
  const client = new AnchorClient({ baseUrl: 'http://localhost:3160' });

  it('A: Should do basic operation', async () => {
    const result = await client.search('test');
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('B: Should do advanced operation', async () => {
    const result = await client.search('test', {
      maxResults: 20,
      buckets: ['inbox']
    });
    expect(result.results.length).toBeLessThanOrEqual(20);
  });
});
```

### Dashboard Test Template

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Component } from '../pages/Component';

describe('Component - A+B Tests', () => {
  it('A: Should render basic UI', () => {
    render(<Component />);
    expect(screen.getByTestId('basic')).toBeInTheDocument();
  });

  it('B: Should handle advanced interaction', async () => {
    render(<Component />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('Success')).toBeInTheDocument();
  });
});
```

## Performance Testing

Benchmarks included in E2E tests:

- **Search Latency:** <200ms p95
- **Concurrent Requests:** 10 requests in <5s
- **Memory Usage:** <1GB during tests
- **File Operations:** <1s for 10MB files

## Troubleshooting

### Tests Fail Immediately
- Check if engine is running (for E2E)
- Verify `pnpm install` completed
- Check Node.js version (v20+)

### Timeout Errors
- Increase `TEST_TIMEOUT` environment variable
- Check network connectivity
- Verify engine performance

### Coverage Not Generated
- Ensure `@vitest/coverage-v8` is installed
- Check vitest config has coverage section
- Run with `--coverage` flag

## Future Enhancements

- [ ] Visual regression testing for dashboard
- [ ] Load testing with k6
- [ ] Browser extension tests (Playwright)
- [ ] Mobile responsiveness tests
- [ ] Accessibility tests (a11y)
