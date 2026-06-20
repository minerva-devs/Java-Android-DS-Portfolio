/**
 * End-to-End UI Verification Tests
 *
 * These tests use real engine API calls to verify the UI functionality
 * and validate search, navigation, distillation workflows.
 * They follow ux-ui-recursion-workflow.md spec (S1-S9).
 *
 * Location: tests/e2e/ui-verification.test.ts
 */

import { describe, it, expect } from 'vitest';
import axios from 'axios';

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3160';

// Test queries from ux-ui-recursion-workflow.md (S1-S9)
const TEST_QUERIES: Array<{ name: string; query: string; expectedBehavior: string }> = [
  // Single Name Entity Queries (S1-S3)
  {
    name: 'single-name-entity-query',
    query: 'Coda C-001',
    expectedBehavior: 'Returns songs, lyrics, related artists with high scores'
  },
  {
    name: 'named-person',
    query: 'Robert Fripp',
    expectedBehavior: 'Returns biographical info, discography, related artists'
  },
  {
    name: 'technical-term',
    query: 'simhash deduplication',
    expectedBehavior: 'Returns documentation, implementation details, related algorithms'
  },
  // Descriptive Sentence Queries (S4-S6)
  {
    name: 'descriptive-sentence',
    query: 'How does the STAR algorithm handle temporal decay?',
    expectedBehavior: 'Returns multiple context windows with temporal decay applied'
  },
  {
    name: 'technical-explanation',
    query: 'Explain max-recall search strategy in Anchor Engine',
    expectedBehavior: 'Returns comprehensive explanation with related concepts'
  },
  {
    name: 'comparison-query',
    query: 'What are the differences between standard and max-recall searches?',
    expectedBehavior: 'Returns comparative analysis with examples'
  },
  // Question Phrase Queries (S7-S9)
  {
    name: 'question-phrase',
    query: 'What is the purpose of radial distillation?',
    expectedBehavior: 'Returns high recall with context inflation (up to 618k chars)'
  },
  {
    name: 'technical-how-to',
    query: 'How do I configure the ingestion watchdog in settings?',
    expectedBehavior: 'Returns step-by-step instructions with UI references'
  },
  {
    name: 'concept-exploration',
    query: 'Tell me about the Phoenix Protocol backup system',
    expectedBehavior: 'Returns detailed overview with multi-hop graph traversal'
  },
];

describe('UI Verification Tests - Following ux-ui-recursion-workflow.md spec (S1-S9)', () => {
  
  beforeAll(async () => {
    console.log('[Test Setup] API URL:', BASE_URL);
    
    // Verify engine is running
    const healthResponse = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    expect(healthResponse.status).toBe(200);
    console.log('[Test] ✓ Engine healthy:', healthResponse.data.message);
  });

  /**
   * Phase 1: Homepage & Navigation Verification
   */
  describe('Phase 1 - Homepage Display', () => {
    it('should verify homepage loads correctly', async () => {
      const response = await axios.get(`${BASE_URL}/`, { timeout: 5000 });
      expect(response.status).toBe(200);
      
      // Verify page contains Anchor Engine content
      expect(response.data).toContain('Anchor');
      console.log('[Test] ✓ Homepage loads correctly');
    });

    it('should verify search page loads', async () => {
      const response = await axios.get(`${BASE_URL}/search`, { timeout: 5000 });
      expect(response.status).toBe(200);
      
      // Verify page contains search functionality
      expect(response.data).toContain('search');
      console.log('[Test] ✓ Search page loads correctly');
    });

    it('should verify settings page loads', async () => {
      const response = await axios.get(`${BASE_URL}/settings`, { timeout: 5000 });
      expect(response.status).toBe(200);
      
      // Verify page contains settings functionality
      expect(response.data).toContain('settings');
      console.log('[Test] ✓ Settings page loads correctly');
    });

    it('should navigate between pages successfully', async () => {
      const homepage = await axios.get(`${BASE_URL}/`, { timeout: 5000 });
      const searchPage = await axios.get(`${BASE_URL}/search`, { timeout: 5000 });
      const settingsPage = await axios.get(`${BASE_URL}/settings`, { timeout: 5000 });
      
      expect(homepage.status).toBe(200);
      expect(searchPage.status).toBe(200);
      expect(settingsPage.status).toBe(200);
      
      console.log('[Test] ✓ Navigation between pages works correctly');
    });
  });

  /**
   * Phase 2: Search Testing with Various Query Types (S1-S9)
   */
  describe('Phase 2 - Search Testing with Various Query Types', () => {
    it('should handle single name entity queries (S1-S3)', async () => {
      const queries = TEST_QUERIES.filter(q => q.name.includes('single-name') || q.name === 'named-person' || q.name === 'technical-term');
      
      for (const testQuery of queries as any[]) {
        console.log(`\n[Test S${testQuery.name}] Testing: "${testQuery.query}"`);
        
        const response = await axios.post(
          `${BASE_URL}/v1/memory/search`,
          { query: testQuery.query, max_results: 5 },
          { timeout: 30000 }
        );

        expect(response.status).toBe(200);
        console.log(`[Test S${testQuery.name}] ✓ Query returned ${Array.isArray(response.data.results) ? response.data.results.length : 0} results`);
      }
    });

    it('should handle descriptive sentence queries (S4-S6)', async () => {
      const queries = TEST_QUERIES.filter(q => q.name.includes('descriptive') || q.name === 'technical-explanation' || q.name === 'comparison-query');
      
      for (const testQuery of queries as any[]) {
        console.log(`\n[Test S${testQuery.name}] Testing: "${testQuery.query}"`);
        
        const response = await axios.post(
          `${BASE_URL}/v1/memory/search`,
          { query: testQuery.query, max_results: 5 },
          { timeout: 30000 }
        );

        expect(response.status).toBe(200);
        console.log(`[Test S${testQuery.name}] ✓ Query returned ${Array.isArray(response.data.results) ? response.data.results.length : 0} results`);
      }
    });

    it('should handle question phrase queries (S7-S9)', async () => {
      const queries = TEST_QUERIES.filter(q => q.name.includes('question') || q.name === 'technical-how-to' || q.name === 'concept-exploration');
      
      for (const testQuery of queries as any[]) {
        console.log(`\n[Test S${testQuery.name}] Testing: "${testQuery.query}"`);
        
        const response = await axios.post(
          `${BASE_URL}/v1/memory/search`,
          { query: testQuery.query, max_results: 5 },
          { timeout: 30000 }
        );

        expect(response.status).toBe(200);
        console.log(`[Test S${testQuery.name}] ✓ Query returned ${Array.isArray(response.data.results) ? response.data.results.length : 0} results`);
      }
    });
  });

  /**
   * Phase 3: File Creation & Distillation Workflow
   */
  describe('Phase 3 - File Creation & Distillation Workflow', () => {
    it('should test API distillation endpoint without seed words', async () => {
      const response = await axios.post(
        `${BASE_URL}/v1/memory/distill`,
        { max_molecules: 5, include_code: false, timeout_seconds: 30 },
        { timeout: 60000 }
      );

      expect(response.status).toBe(200);
      
      const data = response.data;
      console.log(`[Test] ✓ Distillation completed: ${Array.isArray(data.molecules) ? data.molecules.length : 0} molecules`);
      
      // Verify distillation output structure
      if (data.molecules && Array.isArray(data.molecules)) {
        expect(data.molecules.length).toBeGreaterThan(0);
      }
    });

    it('should test search exploration endpoint', async () => {
      const response = await axios.post(
        `${BASE_URL}/v1/memory/explore`,
        { seed: { query: 'STAR algorithm' }, max_depth: 2, max_results: 5 },
        { timeout: 30000 }
      );

      expect(response.status).toBe(200);
      
      const data = response.data;
      console.log(`[Test] ✓ Exploration completed: ${Array.isArray(data.results) ? data.results.length : 0} results`);
    });
  });

  /**
   * Phase 4: Recursion Testing (Search → File → Distill)
   */
  describe('Phase 4 - Recursion Testing', () => {
    it('should complete full workflow search → distill pipeline', async () => {
      // Step 1: Search
      const searchResponse = await axios.post(
        `${BASE_URL}/v1/memory/search`,
        { query: 'recursive search fallbacks in Anchor Engine', max_results: 5 },
        { timeout: 30000 }
      );

      expect(searchResponse.status).toBe(200);
      
      // Step 2: Distill (without seed words)
      const distillResponse = await axios.post(
        `${BASE_URL}/v1/memory/distill`,
        { max_molecules: 5, include_code: false, timeout_seconds: 30 },
        { timeout: 60000 }
      );

      expect(distillResponse.status).toBe(200);
      
      console.log('[Test] ✓ Full workflow completed successfully');
    });
  });

  /**
   * Phase 5: GitHub Ingestion Tests
   */
  describe('Phase 5 - GitHub Ingestion Workflow', () => {
    it('should verify GitHub ingestion endpoint exists', async () => {
      // Use the correct endpoint: /v1/memory/github/clone
      const response = await axios.post(
        `${BASE_URL}/v1/memory/github/clone`,
        { repo_url: 'https://github.com/RSBalchII/anchor-engine-node', branch: 'main' },
        { timeout: 60000 }
      );

      expect(response.status).toBe(200);
      console.log('[GitHub Ingestion] ✓ GitHub ingestion endpoint responds correctly');
    });

    it('should test full GitHub clone workflow', async () => {
      const repoUrl = 'https://github.com/RSBalchII/anchor-engine-node';
      
      console.log(`[GitHub Ingestion] Cloning repository: ${repoUrl}`);
      
      // Clone repository
      const cloneResponse = await axios.post(
        `${BASE_URL}/v1/memory/github/clone`,
        { repo_url: repoUrl, branch: 'main' },
        { timeout: 120000 }
      );

      expect(cloneResponse.status).toBe(200);
      
      const data = cloneResponse.data;
      expect(data.success).toBe(true);
      console.log(`[GitHub Ingestion] ✓ Repository cloned to: ${data.local_path}`);
    });

    it('should test GitHub ingestion with specific path', async () => {
      const repoUrl = 'https://github.com/RSBalchII/anchor-engine-node';
      
      const response = await axios.post(
        `${BASE_URL}/v1/files/upload`,
        { 
          file_type: 'github', 
          repo_url: repoUrl,
          path: 'tests/e2e',
          destination: 'github-test'
        },
        { timeout: 60000 }
      );

      expect(response.status).toBe(200);
      console.log('[GitHub Ingestion] ✓ Specific path ingestion works');
    });
  });
});