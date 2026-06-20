/**
 * Circuit Breaker Pattern Implementation for Anchor Engine
 *
 * Provides circuit breaker functionality for resilient service calls.
 * Implements the standard circuit breaker pattern with failure tracking.
 */

import { StructuredLogger } from './structured-logger.js';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Time in ms to wait before trying half-open */
  resetTimeout?: number;
  /** Time in ms to wait in half-open state */
  halfOpenTimeout?: number;
  /** Whether to enable circuit breaker */
  enabled?: boolean;
  /** Custom failure predicate */
  shouldFail?: (error: Error) => boolean;
}

export interface CircuitBreaker {
  getState(): CircuitState;
  recordSuccess(): void;
  recordFailure(error?: Error): void;
  canExecute(): boolean;
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getStats(): {
    totalCalls: number;
    successes: number;
    failures: number;
    currentState: CircuitState;
  };
}

export class CircuitBreakerImpl implements CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenAttempts: number = 0;
  
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenTimeout: number;
  private readonly enabled: boolean;
  private readonly shouldFail: ((error: Error) => boolean) | undefined;
  private logger: any; // Use any to avoid type issues

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30000; // 30s
    this.halfOpenTimeout = options.halfOpenTimeout ?? 10000; // 10s
    this.enabled = options.enabled ?? true;
    this.shouldFail = options.shouldFail;
    this.logger = {
      info: (msg: string, ctx?: any) => console.info(`[CB] ${msg}`, ctx),
      warn: (msg: string, ctx?: any) => console.warn(`[CB] ${msg}`, ctx),
      error: (msg: string, ctx?: any) => console.error(`[CB] ${msg}`, ctx),
    };
  }

  getState(): CircuitState {
    // Check if we should transition from open to half-open
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.resetTimeout) {
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
        this.logger.info('Circuit breaker transitioning to half-open state');
      }
    }
    // Check if we should transition from half-open to closed/open
    if (this.state === 'half-open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.halfOpenTimeout) {
        if (this.halfOpenAttempts >= 1) {
          this.state = 'closed';
          this.failureCount = 0;
          this.logger.info('Circuit breaker closed after successful half-open attempt');
        } else {
          this.state = 'open';
          this.logger.info('Circuit breaker remained open after failed half-open attempt');
        }
      }
    }
    return this.state;
  }

  recordSuccess(): void {
    if (!this.enabled) return;
    
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
    this.state = 'closed';
    this.logger.info('Circuit breaker reset to closed state');
  }

  recordFailure(error?: Error): void {
    if (!this.enabled) return;
    
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.shouldFail && !this.shouldFail(error || new Error('Unknown error'))) {
      this.failureCount--; // Don't count this failure
      return;
    }

    if (this.state === 'closed' && this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      this.logger.warn(
        `Circuit breaker opened after ${this.failureCount} failures`,
        { error: error?.message }
      );
    } else if (this.state === 'half-open') {
      this.halfOpenAttempts++;
      this.logger.info('Half-open attempt failed, counting failure');
    }
  }

  canExecute(): boolean {
    this.getState(); // Ensure state is up to date
    return this.state === 'closed' || this.state === 'half-open';
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return await fn();
    }

    if (!this.canExecute()) {
      throw new Error(`Circuit breaker is ${this.state}. Please wait before retrying.`);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error as Error);
      throw error;
    }
  }

  getStats(): {
    totalCalls: number;
    successes: number;
    failures: number;
    currentState: CircuitState;
  } {
    return {
      totalCalls: this.failureCount + this.halfOpenAttempts,
      successes: Math.max(0, this.failureCount - this.halfOpenAttempts),
      failures: this.failureCount,
      currentState: this.state,
    };
  }
}

/**
 * Failure Tracker for recording and analyzing failures
 */
export interface FailureTracker {
  recordFailure(type: string, error: Error, context?: Record<string, unknown>): void;
  getStats(): {
    totalFailures: number;
    failuresByType: Record<string, number>;
    recentFailures: Array<{
      type: string;
      error: string;
      context: Record<string, unknown>;
      timestamp: number;
    }>;
  };
  reset(): void;
}

export class FailureTrackerImpl implements FailureTracker {
  private failures: Array<{
    type: string;
    error: Error;
    context: Record<string, unknown>;
    timestamp: number;
  }> = [];
  private readonly maxRecentFailures: number;

  constructor(maxRecentFailures: number = 50) {
    this.maxRecentFailures = maxRecentFailures;
  }

  recordFailure(type: string, error: Error, context?: Record<string, unknown>): void {
    const failure = {
      type,
      error,
      context: context || {},
      timestamp: Date.now(),
    };
    this.failures.push(failure);
    
    // Trim if too many
    if (this.failures.length > this.maxRecentFailures) {
      this.failures = this.failures.slice(-this.maxRecentFailures);
    }
  }

  getStats(): {
    totalFailures: number;
    failuresByType: Record<string, number>;
    recentFailures: Array<{
      type: string;
      error: string;
      context: Record<string, unknown>;
      timestamp: number;
    }>;
  } {
    const failuresByType = this.failures.reduce<Record<string, number>>(
      (acc, f) => {
        acc[f.type] = (acc[f.type] || 0) + 1;
        return acc;
      },
      {}
    );

    return {
      totalFailures: this.failures.length,
      failuresByType,
      recentFailures: this.failures.map(f => ({
        type: f.type,
        error: f.error.message,
        context: f.context,
        timestamp: f.timestamp,
      })),
    };
  }

  reset(): void {
    this.failures = [];
  }
}

/**
 * Circuit Breaker Factory for creating circuit breakers with shared state
 */
export class CircuitBreakerFactory {
  private static breakers = new Map<string, CircuitBreakerImpl>();

  /**
   * Create or get a circuit breaker for a given service name
   */
  static createBreaker(
    serviceName: string,
    options: CircuitBreakerOptions = {}
  ): CircuitBreakerImpl {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreakerImpl(options));
    }
    return this.breakers.get(serviceName)!;
  }

  /**
   * Get all circuit breakers
   */
  static getAllBreakers(): Map<string, CircuitBreakerImpl> {
    return new Map(this.breakers);
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    this.breakers.clear();
  }
}
