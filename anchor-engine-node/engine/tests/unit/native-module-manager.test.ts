/**
 * Unit tests for NativeModuleManager
 * 
 * Tests singleton pattern, module loading, and fallback implementations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock helper for vitest (vi.fn equivalent)
const mockFn = () => {
  const fn: any = (...args: any[]) => fn.mock.calls.push(args);
  fn.mock = { calls: [] };
  return fn;
};

// Mock path-manager with vitest mock function pattern (inlined to avoid hoisting issue)

vi.mock('../../src/utils/path-manager.js', () => ({
  pathManager: {
    getNativePath: (binaryName: string) => {
      // Return different paths based on binary name to trigger different behaviors
      if (binaryName.includes('fail')) return '/path/to/fail.node';
      if (binaryName.includes('success')) return '/path/to/success.node';
      return '/path/to/' + binaryName;
    },
  },
}));

// Mock module/createRequire
vi.mock('module', () => ({
  createRequire: () => {
    return (modulePath: string) => {
      // Throw error for paths containing 'fail' to test fallback behavior
      if (modulePath.includes('fail')) {
        throw new Error('Module not found');
      }
      // Always return a valid module for testing
      return {
        testFunction: () => 'success',
        cleanse: (str: string) => str.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '/'),
        atomize: (content: string, strategy: string) => {
          if (strategy === 'prose') {
            return content.split(/\n\n+/);
          }
          return content.split(/\n\n(?=function)/);
        },
        fingerprint: (str: string) => {
          let hash = 0n;
          for (let i = 0; i < str.length; i++) {
            hash = (hash * 31n + BigInt(str.charCodeAt(i))) & 0xFFFFFFFFFFFFFFFFn;
          }
          return hash;
        },
        distance: (a: bigint, b: bigint) => {
          let xor = a ^ b;
          let count = 0n;
          while (xor > 0n) {
            count += xor & 1n;
            xor >>= 1n;
          }
          return Math.min(Number(count), 64);
        },
      };
    };
  },
}));

// Import after mocks
import { NativeModuleManager, nativeModuleManager } from '../../src/utils/native-module-manager.js';
import { pathManager } from '../../src/utils/path-manager.js';

describe('NativeModuleManager', () => {
  let manager: any;

  beforeEach(() => {
    // Reset singleton instance for testing isolation
    // @ts-ignore - Accessing private property for testing
    NativeModuleManager.instance = undefined;
    manager = NativeModuleManager.getInstance();
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NativeModuleManager.getInstance();
      const instance2 = NativeModuleManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export a singleton instance', () => {
      expect(nativeModuleManager).toBeDefined();
      expect(nativeModuleManager).toBeInstanceOf(NativeModuleManager);
      expect(typeof nativeModuleManager.loadNativeModule).toBe('function');
      expect(typeof nativeModuleManager.getStatus).toBe('function');
      expect(typeof nativeModuleManager.isUsingFallback).toBe('function');
      expect(typeof nativeModuleManager.getAllStatus).toBe('function');
    });
  });

  describe('Module Loading - ece_native (Forced Fallback)', () => {
    it('should force fallback for ece_native without attempting to load native module', () => {
      const module = manager.loadNativeModule('ece_native', 'ece_native.node');

      expect(module).toBeDefined();
      expect(typeof module.cleanse).toBe('function');
      expect(typeof module.atomize).toBe('function');
      expect(typeof module.fingerprint).toBe('function');
      expect(typeof module.distance).toBe('function');

      expect(manager.isUsingFallback('ece_native')).toBe(true);

      const status = manager.getStatus('ece_native');
      expect(status).toBeDefined();
      expect(status?.loaded).toBe(true); // Fallback is considered loaded
      expect(status?.fallbackActive).toBe(true);
    });
  });

  describe('Module Loading - Standard', () => {
    it('should cache modules on subsequent calls', () => {
      // Note: Full module loading tests require native module setup
      // This test verifies the caching mechanism
      const module1 = manager.loadNativeModule('ece_native', 'ece_native.node');
      const module2 = manager.loadNativeModule('ece_native', 'ece_native.node');

      expect(module1).toBe(module2);
    });
  });

  describe('ece_native Fallback Implementations', () => {
    let eceModule: any;

    beforeEach(() => {
      eceModule = manager.loadNativeModule('ece_native', 'ece_native.node');
    });

    describe('cleanse', () => {
      it('should un-escape strings', () => {
        const input = 'This is a \\"test\\" with \\n newlines and \\t tabs';
        const result = eceModule.cleanse(input);
        expect(result).toBe('This is a "test" with \n newlines and \t tabs');
      });

      it('should remove metadata keys', () => {
        const input = '{"type":"message", "timestamp":"123", "source":"user", "content":"Hello"}';
        const result = eceModule.cleanse(input);
        expect(result).not.toContain('"type":"message"');
        expect(result).not.toContain('"timestamp":"123"');
        expect(result).not.toContain('"source":"user"');
      });

      it('should compress slashes', () => {
        const input = String.raw`path\\dir\\file`;
        const result = eceModule.cleanse(input);
        expect(result).toBe('path/dir/file');
      });

      it('should correctly compress multiple backslashes', () => {
        const input = String.raw`path\\\\file`;
        const result = eceModule.cleanse(input);
        expect(result).toBe('path/file');
      });
    });

    describe('atomize', () => {
      it('should atomize code strategy', () => {
        const input = `
function test1() {
  return 1;
}

function test2() {
  return 2;
}
`;
        const result = eceModule.atomize(input, 'code');
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toContain('function test1()');
      });

      it('should atomize prose strategy', () => {
        const input = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3';
        const result = eceModule.atomize(input, 'prose');
        expect(result.length).toBe(3);
        expect(result[0]).toBe('Paragraph 1');
        expect(result[1]).toBe('Paragraph 2');
        expect(result[2]).toBe('Paragraph 3');
      });
    });

    describe('fingerprint', () => {
      it('should return a bigint', () => {
        const input = 'this is a test string for fingerprinting';
        const result = eceModule.fingerprint(input);
        expect(typeof result).toBe('bigint');
      });

      it('should return identical fingerprints for identical inputs', () => {
        const input = 'this is a test string for fingerprinting';
        const result1 = eceModule.fingerprint(input);
        const result2 = eceModule.fingerprint(input);
        expect(result1).toBe(result2);
      });

      it('should handle small inputs', () => {
        const result = eceModule.fingerprint('tiny');
        expect(typeof result).toBe('bigint');
      });
    });

    describe('distance', () => {
      it('should calculate hamming distance between identical bigints', () => {
        const a = BigInt('0b101010');
        const b = BigInt('0b101010');
        const result = eceModule.distance(a, b);
        expect(result).toBe(0);
      });

      it('should calculate hamming distance between different bigints', () => {
        const a = BigInt('0b101010'); // 42
        const b = BigInt('0b111000'); // 56
        // XOR: 0b010010 (18) -> 2 bits set
        const result = eceModule.distance(a, b);
        expect(result).toBe(2);
      });

      it('should respect maximum bit count (64)', () => {
        const a = (1n << 64n) - 1n;
        const b = 0n;
        const result = eceModule.distance(a, b);
        expect(result).toBe(64);
      });
    });
  });

  describe('getAllStatus', () => {
    it('should return status of all loaded modules', () => {
      manager.loadNativeModule('ece_native', 'ece_native.node'); // Forced fallback
      manager.loadNativeModule('ece_native', 'ece_native.node'); // Same module again (cached)

      const allStatus = manager.getAllStatus();

      expect(allStatus.size).toBe(1);
      expect(allStatus.get('ece_native')?.fallbackActive).toBe(true);
      expect(allStatus.get('ece_native')?.loaded).toBe(true);
    });
  });
});
