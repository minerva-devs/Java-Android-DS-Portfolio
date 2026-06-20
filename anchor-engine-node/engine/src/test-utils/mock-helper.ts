/**
 * Mock Helper Utility for Test Queue Management
 * 
 * Provides queue-based mockResolvedValueOnce and mockRejectedValueOnce support.
 * Useful for testing async operations like fetch() with controlled responses.
 */

interface MockQueueItem {
  type: 'resolve' | 'reject';
  value: unknown;
}

export class MockHelper {
  private queue: Array<MockQueueItem> = [];
  private customImpl?: Function;

  mockResolvedValueOnce(value: any): this {
    this.queue.push({ type: 'resolve', value });
    return this;
  }

  mockRejectedValueOnce(error: any): this {
    this.queue.push({ type: 'reject', value: error });
    return this;
  }

  mockImplementation(impl: Function): this {
    this.customImpl = impl;
    return this;
  }

  clearQueue(): void {
    this.queue.splice(0);
  }

  /**
   * Wrap a function to use our mock queue instead of calling the original.
   */
  apply(fn: Function): (...args: any[]) => Promise<unknown> | unknown {
    const _fn = fn; // Capture reference to original function

    return async (...args: any[]): Promise<any> => {
      // If custom implementation is set, use it
      if (this.customImpl) {
        return this.customImpl(...args);
      }

      // If queue has items, pop the next one
      if (this.queue.length > 0) {
        const item = this.queue.shift() as MockQueueItem;
        if (item.type === 'resolve') {
          return Promise.resolve(item.value);
        } else {
          return Promise.reject(item.value);
        }
      }

      // Fall back to calling the original function
      return _fn.apply(this, args);
    };
  }
}
