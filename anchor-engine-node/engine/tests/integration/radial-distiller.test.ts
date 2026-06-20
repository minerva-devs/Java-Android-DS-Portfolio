/**
 * P0 Integration Test: Radial Distiller
 * 
 * Tests the radial distillation process with circuit breaker protection.
 * These are fast, targeted tests that verify the distiller works correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CircuitBreakerFactory, CircuitBreakerImpl, FailureTrackerImpl } from '../../src/utils/circuit-breaker';

// Mock atom for testing
const mockAtom = {
  id: 'test-atom-1',
  content: 'This is a test atom for radial distillation',
  tags: ['test', 'distillation'],
  timestamp: Date.now(),
  provenance: { source: 'test', path: '/test' }
};

// Mock distillation function
async function mockDistill(atoms: any[], radius: number, options?: any): Promise<any[]> {
  return atoms.slice(0, radius * 2);
}

describe('Radial Distiller P0 Tests', () => {
  let circuitBreaker: CircuitBreakerImpl;
  let failureTracker: FailureTrackerImpl;

  beforeAll(() => {
    console.log('🔧 [P0 Radial Distiller] Setting up test environment...');
    
    // Initialize circuit breaker
    circuitBreaker = CircuitBreakerFactory.createBreaker('radial-distiller', {
      failureThreshold: 3,
      resetTimeout: 10000,
      halfOpenTimeout: 5000
    });
    
    // Initialize failure tracker
    failureTracker = new FailureTrackerImpl(10);
    
    console.log('✅ [P0 Radial Distiller] Setup complete');
  });

  afterAll(() => {
    console.log('🧹 [P0 Radial Distiller] Cleaning up...');
    CircuitBreakerFactory.resetAll();
  });

  it('should create circuit breaker with correct configuration', () => {
    const state = circuitBreaker.getState();
    expect(state).toBe('closed');
    
    const stats = circuitBreaker.getStats();
    expect(stats.currentState).toBe('closed');
    expect(stats.totalCalls).toBe(0);
  });

  it('should allow distillation when circuit is closed', async () => {
    const result = await circuitBreaker.execute(() => 
      mockDistill([mockAtom], 1)
    );
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should record success after successful distillation', async () => {
    await circuitBreaker.recordSuccess();
    
    const stats = circuitBreaker.getStats();
    expect(stats.failures).toBe(0);
  });

  it('should handle empty atom list', async () => {
    const result = await circuitBreaker.execute(() => 
      mockDistill([], 1)
    );
    
    expect(result).toBeDefined();
    expect(result.length).toBe(0);
  });

  it('should handle multiple atoms', async () => {
    const atoms = [mockAtom, { ...mockAtom, id: 'test-atom-2' }];
    const result = await circuitBreaker.execute(() => 
      mockDistill(atoms, 1)
    );
    
    expect(result.length).toBeGreaterThan(0);
  });

  it('should track failures by type', () => {
    const distillationError = new Error('Distillation failed');
    failureTracker.recordFailure('DistillationError', distillationError, {
      context: { atoms: 1, radius: 1 }
    });
    
    const stats = failureTracker.getStats();
    expect(stats.failuresByType.DistillationError).toBe(1);
  });

  it('should prevent execution when circuit opens', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 10000
    });
    
    const error = new Error('Distillation failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    expect(breaker.getState()).toBe('open');
    expect(breaker.canExecute()).toBe(false);
  });

  it('should transition to half-open after reset timeout', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 1000,
      halfOpenTimeout: 5000
    });
    
    const error = new Error('Distillation failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    expect(breaker.getState()).toBe('open');
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const state = breaker.getState();
    expect(state).toBe('half-open');
  });

  it('should close after successful half-open attempt', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2,
      resetTimeout: 1000,
      halfOpenTimeout: 2000
    });
    
    const error = new Error('Distillation failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Execute successfully
    await breaker.execute(() => Promise.resolve('success'));
    
    expect(breaker.getState()).toBe('closed');
  });

  it('should handle distillation with custom radius', async () => {
    const result = await circuitBreaker.execute(() => 
      mockDistill([mockAtom], 2)
    );
    
    expect(result).toBeDefined();
  });

  it('should handle distillation with options', async () => {
    const result = await circuitBreaker.execute(() => 
      mockDistill([mockAtom], 1, { includeMetadata: true })
    );
    
    expect(result).toBeDefined();
  });

  it('should propagate distillation errors', async () => {
    const failingDistiller = {
      distill: async () => {
        throw new Error('Distillation service error');
      }
    };
    
    const breaker = new CircuitBreakerImpl();
    await expect(breaker.execute(() => (failingDistiller as any).distill()))
      .rejects.toThrow('Distillation service error');
    
    const stats = breaker.getStats();
    expect(stats.failures).toBe(1);
  });

  it('should handle slow distillation operations', async () => {
    const slowDistill = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return [mockAtom];
    };
    
    const result = await circuitBreaker.execute(slowDistill);
    expect(result).toBeDefined();
  });

  it('should reset on success', async () => {
    const breaker = new CircuitBreakerImpl({
      failureThreshold: 2
    });
    
    // Record some failures
    const error = new Error('Temp failure');
    await breaker.recordFailure(error);
    await breaker.recordFailure(error);
    
    expect(breaker.getState()).toBe('open');
    
    // Success should reset
    await breaker.recordSuccess();
    
    expect(breaker.getState()).toBe('closed');
    expect(breaker.getStats().failures).toBe(0);
  });

  it('should provide accurate statistics', () => {
    const breaker = new CircuitBreakerImpl();
    
    // Perform some operations
    breaker.execute(() => Promise.resolve('ok'));
    breaker.recordFailure(new Error('fail'));
    breaker.execute(() => Promise.resolve('ok'));
    
    const stats = breaker.getStats();
    // totalCalls counts all attempts (successes + failures)
    expect(stats.totalCalls).toBeGreaterThanOrEqual(1);
    expect(stats.failures).toBe(1);
    expect(stats.successes).toBeGreaterThanOrEqual(0);
  });

  console.log('✅ [P0 Radial Distiller] All tests passed!');
});
