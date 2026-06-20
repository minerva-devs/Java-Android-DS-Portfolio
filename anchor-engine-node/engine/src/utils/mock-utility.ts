/**
 * Simplified mock utility for Vitest compatibility
 */
import { vi } from 'vitest';

export interface QueueableMock<T = unknown> {
  /** Queue a resolved value */
  mockResolvedValueOnce(value: any): this;
  /** Queue a rejected value */
  mockRejectedValueOnce(error: unknown): this;
  /** Set permanent return value */
  mockReturnValue(value: T): this;
  /** Set permanent resolved value for async mocks */
  mockResolvedValue(value: any): this;
  getNextQueuedResult(): { type: 'resolve' | 'reject', value: unknown } | null;
  clearQueue(): void;
}

function createEnhancedMock<T = unknown>(originalFn?: (...args: any[]) => T): QueueableMock<T> {
  const mockQueue: Array<{ type: 'resolve' | 'reject'; value: unknown }> = [];
  // @ts-ignore - Mock functions lose static context in Vitest
  const baseMock = vi.fn(originalFn || (() => undefined)) as any;

  (baseMock.mockResolvedValueOnce as any) = function(this: any, value: any) {
    mockQueue.push({ type: 'resolve', value });
    return this;
  };

  // @ts-ignore - Mock functions lose static context in Vitest
  baseMock.mockRejectedValueOnce = function(this: any, error: unknown) {
    mockQueue.push({ type: 'reject', value: error });
    return this;
  };

  (baseMock.mockReturnValue as any) = function(this: any, value: T) {
    if (mockQueue.length) return this;
    return baseMock.mockReturnValue.call(this as any, value);
  };

  // @ts-ignore - Mock functions lose static context in Vitest
  baseMock.mockResolvedValue = function(this: any, value: any) {
    if (mockQueue.length) return this;
    return baseMock.mockResolvedValue.call(this as any, value);
  };

  // @ts-ignore - Mock functions lose static context in Vitest
  baseMock.getNextQueuedResult = function(this: any): any {
    const r = mockQueue.shift();
    return r ? { type: (r.type as 'resolve' | 'reject'), value: r.value } : null;
  };

  // @ts-ignore - Mock functions lose static context in Vitest
  baseMock.clearQueue = function(this: any) { mockQueue.splice(0, mockQueue.length); };

  // @ts-ignore
  baseMock.mockImplementation = (function(this: any, ...args: any[]) {
    const queued = this.getNextQueuedResult();
    if (queued) return queued.type === 'resolve' ? Promise.resolve(queued.value) : Promise.reject(queued.value);
    return this.getMockImplementation() ? this.getMockImplementation()(this as any, ...args) : undefined;
  });

  return baseMock as unknown as QueueableMock<T>;
}

function createAsyncMock<T = unknown>() {
  const mockQueue: Array<{ type: 'resolve' | 'reject'; value: any }> = [];
  // @ts-ignore - Mock function loses static context in Vitest  
  const mockFn = vi.fn() as any;

  (mockFn.mockResolvedValueOnce as any) = function(this: any, value: any) { 
    mockQueue.push({ type: 'resolve', value }); 
    return this; 
  };
  
  // @ts-ignore - Mock functions lose static context in Vitest
  (mockFn.mockRejectedValueOnce as any) = function(this: any, error: unknown) { 
    mockQueue.push({ type: 'reject', value: error }); 
    return this; 
  };

  const originalResolve = mockFn.mockResolvedValue.bind(null);

  // @ts-ignore - Mock functions lose static context in Vitest
  (mockFn.mockResolvedValue as any) = function(this: any, value: any) {
    if (mockQueue.length) return this;
    return originalResolve.call(null, value);
  };

  // @ts-ignore - Mock functions lose static context in Vitest
  (mockFn.getNextQueuedResult as any) = function(this: any): any {
    const r = mockQueue.shift();
    return r ? { type: (r.type as 'resolve' | 'reject'), value: r.value } : null;
  };

  // @ts-ignore - Mock functions lose static context in Vitest
  (mockFn.mockImplementation as any) = function(this: any, ...args: any[]) {
    const queued = mockFn.getNextQueuedResult();
    if (queued) return queued.type === 'resolve' ? Promise.resolve(queued.value) : Promise.reject(queued.value);
    return Promise.resolve(undefined as T);
  };

  return mockFn as unknown as QueueableMock<Promise<T>>;
}

class MockRegistry {
  private mocks: Array<{ id: string; mock: any }> = [];
  private nextId = 0;

  register(name: string, mockFn: any): string {
    const id = `mock_${this.nextId++}`;
    this.mocks.push({ id, mock: mockFn });
    return id;
  }

  unregister(id: string) { this.mocks = this.mocks.filter(m => m.id !== id); }

  clearAll() {
    this.mocks.forEach(({ mock }) => { mock.clearQueue && mock.clearQueue(); });
  }
}

const mockRegistry = new MockRegistry();
export { createEnhancedMock, createAsyncMock, mockRegistry };