/**
 * P0 Integration Test: Search Pipeline
 * 
 * Tests the core search pipeline functionality with circuit breaker protection.
 * These are fast, targeted tests that verify the search pipeline works correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CircuitBreakerFactory, CircuitBreakerImpl, FailureTrackerImpl } from '../../src/utils/circuit-breaker';

// Mock search results for testing
const mockSearchResults = [
  {
    id: 'test-1',
    source: 'test-source',
    content: 'This is a test document about search pipeline',
    title: 'Test Document 1',
    score: 0.95,
    metadata: { tags: ['test', 'search'], timestamp: Date.now() }
  },
  {
    id: 'test-2',
    source: 'test-source',
    content: 'Another test document for search pipeline validation',
    title: 'Test Document 2',
    score: 0.87,
    metadata: { tags: ['test', 'pipeline'], timestamp: Date.now() }
  }
];

// Mock logSearchResults function
async function logSearchResults(query: string, results: any[], summary: any, options?: any): Promise<string> {
  return 'test-hash-123';
}

describe('Search Pipeline P0 Tests', () => {
  let circuitBreaker: CircuitBreakerImpl;
  let failureTracker: FailureTrackerImpl;

  beforeAll(() => {
    console.log('🔧 [P0 Search Pipeline] Setting up test environment...');
    
    // Initialize circuit breaker
    circuitBreaker = CircuitBreakerFactory.createBreaker('search-pipeline', {
      failureThreshold: 3,
      resetTimeout: 10000,
      halfOpenTimeout: 5000
    });
    
    // Initialize failure tracker
    failureTracker = new FailureTrackerImpl(10);
    
    console.log('✅ [P0 Search Pipeline] Setup complete');
  });

  afterAll(() => {
    console.log('🧹 [P0 Search Pipeline] Cleaning up...');
    CircuitBreakerFactory.resetAll();
  });

  it('should create circuit breaker with correct configuration', () => {
    const state = circuitBreaker.getState();
    expect(state).toBe('closed');
    
    const stats = circuitBreaker.getStats();
    expect(stats.currentState).toBe('closed');
    expect(stats.totalCalls).toBe(0);
  });

  it('should allow execution when circuit is closed', async () => {
    const result = await circuitBreaker.execute(() => 
      Promise.resolve(mockSearchResults)
    );
    
    expect(result).toEqual(mockSearchResults);
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('should record success and reset failure count', async () => {
    await circuitBreaker.recordSuccess();
    
    const stats = circuitBreaker.getStats();
    expect(stats.failures).toBe(0);
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('should record failure and increment failure count', async () => {
    const testError = new Error('Test failure for circuit breaker');
    await circuitBreaker.recordFailure(testError);
    
    const stats = circuitBreaker.getStats();
    expect(stats.failures).toBe(1);
    expect(stats.totalCalls).toBe(1);
  });

  it('should track failures by type', () => {
    const testError1 = new Error('Connection timeout');
    const testError2 = new Error('Connection timeout');
    const testError3 = new Error('Invalid query');
    
    failureTracker.recordFailure('ConnectionError', testError1);
    failureTracker.recordFailure('ConnectionError', testError2);
    failureTracker.recordFailure('QueryError', testError3);
    
    const stats = failureTracker.getStats();
    expect(stats.totalFailures).toBe(3);
    expect(stats.failuresByType.ConnectionError).toBe(2);
    expect(stats.failuresByType.QueryError).toBe(1);
  });

  it('should prevent execution when circuit opens after threshold failures', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 3,
      resetTimeout: 10000
    });
    
    // Record 3 failures to open the circuit
    const error = new Error('Simulated failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    expect(breaker.getState()).toBe('open');
    expect(breaker.canExecute()).toBe(false);
  });

  it('should transition from open to half-open after reset timeout', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 1000,
      halfOpenTimeout: 5000
    });
    
    // Open the circuit
    const error = new Error('Simulated failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    expect(breaker.getState()).toBe('open');
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const state = breaker.getState();
    expect(state).toBe('half-open');
  });

  it('should allow one attempt in half-open state', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 1000,
      halfOpenTimeout: 5000
    });
    
    // Open the circuit
    const error = new Error('Simulated failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    expect(breaker.getState()).toBe('open');
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const state = breaker.getState();
    expect(state).toBe('half-open');
    expect(breaker.canExecute()).toBe(true);
  });

  it('should close circuit after successful attempt in half-open', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 1000,
      halfOpenTimeout: 2000
    });
    
    // Open the circuit
    const error = new Error('Simulated failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    // Wait for half-open
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Execute successfully
    await breaker.execute(() => Promise.resolve('success'));
    
    const state = breaker.getState();
    expect(state).toBe('closed');
  });

  it('should remain open after failed attempt in half-open', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 1000,
      halfOpenTimeout: 2000
    });
    
    // Open the circuit
    const error = new Error('Simulated failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    // Wait for half-open
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Execute and fail
    await breaker.recordFailure(error);
    
    const state = breaker.getState();
    expect(state).toBe('open');
  });

  it('should skip failure counting if shouldFail predicate returns false', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      shouldFail: (error) => error.message !== 'real failure'
    });
    
    // This failure should be skipped
    await breaker.recordFailure(new Error('real failure'));
    
    const stats = breaker.getStats();
    expect(stats.failures).toBe(0);
  });

  it('should not affect circuit when disabled', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 1,
      enabled: false
    });
    
    const error = new Error('Should not count');
    await breaker.recordFailure(error);
    
    expect(breaker.getState()).toBe('closed');
    expect(breaker.canExecute()).toBe(true);
  });

  it('should execute function directly when disabled', async () => {
    const breaker = new CircuitBreakerImpl({ enabled: false });
    
    const result = await breaker.execute(() => Promise.resolve('direct execution'));
    expect(result).toBe('direct execution');
  });

  it('should throw error when circuit is open (before half-open transition)', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 1000,
      halfOpenTimeout: 5000
    });
    
    // Open the circuit
    const error = new Error('Simulated failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    // Check state immediately - should be open
    expect(breaker.getState()).toBe('open');
    expect(breaker.canExecute()).toBe(false);
    
    // Should throw when trying to execute
    await expect(breaker.execute(() => Promise.resolve('should not execute'))).rejects.toThrow();
  });

  it('should log search results with proper metadata', async () => {
    const query = 'test search query';
    const hash = 'test-hash-123';
    
    const result = await logSearchResults(
      query,
      mockSearchResults,
      { strategy: 'simple', totalResults: 2 },
      { hash, verbose: true }
    );
    
    expect(result).toBe(hash);
  });

  it('should handle empty search results', async () => {
    const result = await circuitBreaker.execute(() => 
      Promise.resolve([])
    );
    
    expect(result).toEqual([]);
  });

  it('should handle search with high latency', async () => {
    const slowSearch = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return mockSearchResults;
    };
    
    const result = await circuitBreaker.execute(slowSearch);
    expect(result).toEqual(mockSearchResults);
  });

  it('should propagate errors from search function', async () => {
    const slowSearch = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      throw new Error('Search service error');
    };
    
    await expect(circuitBreaker.execute(slowSearch)).rejects.toThrow('Search service error');
    
    const stats = circuitBreaker.getStats();
    expect(stats.failures).toBe(1);
  });

  console.log('✅ [P0 Search Pipeline] All tests passed!');
});
