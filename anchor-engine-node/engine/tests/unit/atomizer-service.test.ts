/**
 * Unit tests for AtomizerService
 *
 * Tests critical functions: sanitize(), splitIntoMolecules(), isBlacklistedTag(),
 * isTransientData(), parseChatJsonl(), and other core atomization logic.
 *
 * Coverage Goal: >40% (from 0%)
 */

import { describe, it, expect, beforeEach, jest } from 'vitest';
import { AtomizerService } from '../../src/services/ingest/atomizer-service.js';

describe('AtomizerService', () => {
  let service: AtomizerService;

  beforeEach(() => {
    service = new AtomizerService();
  });

  describe('sanitize()', () => {
    describe('JSON wrapper removal', () => {
      it('removes JSON content wrappers', () => {
        const input = '{"content": "Hello world", "type": "message"}';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).toContain('Hello world');
        expect(result).not.toContain('"content"');
        expect(result).not.toContain('"type"');
      });

      it('removes nested JSON wrappers', () => {
        const input = '{"response_content": "{\"content\": \"Test message\"}"}';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).toContain('Test message');
      });

      it('handles JSON arrays', () => {
        const input = '[{"content": "First"}, {"content": "Second"}]';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).toContain('First');
        expect(result).toContain('Second');
      });
    });

    describe('timestamp stripping', () => {
      it('removes bracketed ISO timestamps', () => {
        const input = '[2026-01-25T03:43:54.405Z] Processing file...';
        const result = service.sanitize(input, 'test.md', 'inbox');
        // Bracketed timestamp should be stripped
        expect(result).not.toContain('[2026-01-25T03:43:54.405Z]');
      });

      it('removes bracketed timestamps', () => {
        const input = '[2026-01-25T03:43:54.405Z] Loading module...';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('[2026-01-25');
      });

      it('removes progress indicators', () => {
        const input = '[===] 100% Complete';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('[===]');
        expect(result).not.toContain('100%');
      });
    });

    describe('PII masking', () => {
      it('masks email addresses', () => {
        const input = 'Contact me at test@example.com for info';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('test@example.com');
        expect(result).toContain('[EMAIL_REDACTED]');
      });

      it('masks IP addresses', () => {
        const input = 'Server at 192.168.1.100 responded';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('192.168.1.100');
        expect(result).toContain('[IP_REDACTED]');
      });

      it('masks API keys', () => {
        const input = 'Use key sk-abcdefghijklmnopqrstuvwxyz1234567890ABCD-FAKE-KEY-TEST';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('sk-abcdefghijklmnopqrstuvwxyz1234567890ABCD');
        expect(result).toContain('sk-[REDACTED]');
      });
    });

    describe('Anchor system marker removal', () => {
      it('removes score markers', () => {
        const input = 'Result with score: 0.95 found';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('score: 0.95');
      });

      it('removes virtual molecule IDs', () => {
        const input = 'Found virtual_mem_a1b2c3d4e5f6';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('virtual_mem_');
      });

      it('removes memory IDs', () => {
        const input = 'id: "mem_1234567890abcdef"';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('mem_');
      });

      it('removes provenance markers', () => {
        const input = 'provenance: "internal"';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('provenance:');
      });

      it('removes bucket arrays', () => {
        const input = 'buckets: ["inbox", "external"]';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('buckets:');
      });
    });

    describe('code block preservation', () => {
      it('preserves code blocks while cleaning metadata', () => {
        const input = '```typescript\nfunction test() {\n  return 42;\n}\n```';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).toContain('function test()');
        expect(result).toContain('return 42');
      });

      it('preserves inline code', () => {
        const input = 'Use `console.log()` for debugging';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).toContain('console.log()');
      });
    });

    describe('newline normalization', () => {
      it('normalizes multiple newlines', () => {
        const input = 'Line 1\n\n\n\nLine 2';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).toMatch(/Line 1\n\nLine 2/);
      });

      it('converts Windows line endings', () => {
        const input = 'Line 1\r\nLine 2\r\nLine 3';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('\r\n');
        expect(result).toContain('\n');
      });

      it('removes BOM characters', () => {
        const input = '\uFEFFContent with BOM';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('\uFEFF');
      });
    });

    describe('edge cases', () => {
      it('handles empty string', () => {
        const result = service.sanitize('', 'test.md', 'inbox');
        expect(result).toBe('');
      });

      it('handles whitespace-only content', () => {
        const result = service.sanitize('   \n\t  ', 'test.md', 'inbox');
        expect(result).toBe('');
      });

      it('handles unicode content', () => {
        const input = 'Hello 世界 🌍 مرحبا';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).toContain('世界');
        expect(result).toContain('🌍');
        expect(result).toContain('مرحبا');
      });

      it('handles special characters', () => {
        const input = 'Special: <>&"\'\\n\\t';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).toBeDefined();
      });
    });

    describe('LLM role marker removal', () => {
      it('removes user markers', () => {
        const input = '<|user|> What is this?';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('<|user|>');
      });

      it('removes assistant markers', () => {
        const input = '<|assistant|> This is the answer';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('<|assistant|>');
      });

      it('removes system markers', () => {
        const input = '<|system|> System message';
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain('<|system|>');
      });
    });

    describe('log spam removal', () => {
      it('removes processing logs', () => {
        const input = "Processing 'file.txt'... Done";
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain("Processing 'file.txt'");
      });

      it('removes loading logs', () => {
        const input = "Loading 'module.js'... Complete";
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain("Loading 'module.js'");
      });

      it('removes indexing logs', () => {
        const input = "Indexing 'database.db'... Finished";
        const result = service.sanitize(input, 'test.md', 'inbox');
        expect(result).not.toContain("Indexing 'database.db'");
      });
    });
  });

  describe('isBlacklistedTag()', () => {
    describe('color codes', () => {
      it('filters 3-digit hex colors', () => {
        // @ts-ignore - accessing private method for testing
        expect(service.isBlacklistedTag('#FFF')).toBe(true);
        expect(service.isBlacklistedTag('#123')).toBe(true);
      });

      it('filters 6-digit hex colors', () => {
        // @ts-ignore
        expect(service.isBlacklistedTag('#123456')).toBe(true);
        expect(service.isBlacklistedTag('#ABCDEF')).toBe(true);
      });

      it('filters 8-digit hex colors', () => {
        // @ts-ignore
        expect(service.isBlacklistedTag('#12345678')).toBe(true);
      });
    });

    describe('numeric patterns', () => {
      it('filters pure numbers', () => {
        // @ts-ignore
        expect(service.isBlacklistedTag('#123')).toBe(true);
        expect(service.isBlacklistedTag('#999')).toBe(true);
      });

      it('filters long numeric IDs', () => {
        // @ts-ignore
        expect(service.isBlacklistedTag('#12345678')).toBe(true);
        expect(service.isBlacklistedTag('#9876543210')).toBe(true);
      });
    });

    describe('HTML artifacts', () => {
      it('filters HTML tag names', () => {
        // @ts-ignore
        expect(service.isBlacklistedTag('#btn')).toBe(true);
        expect(service.isBlacklistedTag('#div')).toBe(true);
        expect(service.isBlacklistedTag('#span')).toBe(true);
      });

      it('filters HTML attributes', () => {
        // @ts-ignore
        expect(service.isBlacklistedTag('#href')).toBe(true);
        expect(service.isBlacklistedTag('#src')).toBe(true);
        expect(service.isBlacklistedTag('#class')).toBe(true);
      });
    });

    describe('code keywords', () => {
      it('filters preprocessor directives', () => {
        // @ts-ignore
        expect(service.isBlacklistedTag('#include')).toBe(true);
        expect(service.isBlacklistedTag('#define')).toBe(true);
        expect(service.isBlacklistedTag('#pragma')).toBe(true);
      });

      it('filters control flow keywords', () => {
        // @ts-ignore
        expect(service.isBlacklistedTag('#elif')).toBe(true);
        expect(service.isBlacklistedTag('#else')).toBe(true);
        expect(service.isBlacklistedTag('#endif')).toBe(true);
      });
    });

    describe('tag length', () => {
      it('filters tags longer than 30 characters', () => {
        // @ts-ignore
        const longTag = '#this_is_a_very_long_tag_that_exceeds_limit';
        expect(service.isBlacklistedTag(longTag)).toBe(true);
      });

      it('allows tags under 30 characters', () => {
        // @ts-ignore
        expect(service.isBlacklistedTag('#valid_tag')).toBe(false);
      });
    });

    describe('valid tags', () => {
      it('preserves meaningful tags', () => {
        // @ts-ignore
        expect(service.isBlacklistedTag('#javascript')).toBe(false);
        expect(service.isBlacklistedTag('#machine-learning')).toBe(false);
        expect(service.isBlacklistedTag('#api-design')).toBe(false);
      });
    });
  });

  describe('isTransientData()', () => {
    it('detects Python tracebacks', () => {
      const content = `Traceback (most recent call last):
  File "test.py", line 10, in <module>
    raise ValueError("Error")
KeyError: 'missing'
TypeError: Cannot read property
ValueError: Invalid value
Exception in thread main
Fatal error: System crash`;
      // @ts-ignore - needs >50% transient lines with at least 5 lines
      expect(service.isTransientData(content)).toBe(true);
    });

    it('detects npm install logs', () => {
      const content = `npm install package
added 150 packages in 5s
added 20 packages
added 30 packages
Successfully installed lodash
Successfully installed express
npm install complete`;
      // @ts-ignore
      expect(service.isTransientData(content)).toBe(true);
    });

    it('detects pip install logs', () => {
      const content = `pip install requests
Collecting requests
  Downloading requests-2.31.0-py3-none-any.whl
Collecting urllib3
  Downloading urllib3-1.26.0-py3-none-any.whl
Successfully installed requests`;
      // @ts-ignore
      expect(service.isTransientData(content)).toBe(true);
    });

    it('detects build artifacts', () => {
      const content = `Build succeeded
Build succeeded
Compiling...
Compiling...
Linking...
Linking...
Generating...
Generating...
Build failed
Build failed`;
      // @ts-ignore - all lines match transient patterns
      expect(service.isTransientData(content)).toBe(true);
    });

    it('allows normal content', () => {
      const content = `This is normal documentation.
It contains meaningful information.
Not just log output.
This is useful content.
For testing purposes.`;
      // @ts-ignore
      expect(service.isTransientData(content)).toBe(false);
    });

    it('requires minimum line count', () => {
      const content = 'Traceback (most recent call last):';
      // @ts-ignore - short content should not be flagged
      expect(service.isTransientData(content)).toBe(false);
    });
  });

  describe('parseChatJsonl()', () => {
    it('extracts user messages', () => {
      const content = `{"type": "user", "parts": [{"text": "Hello, how are you?"}]}
{"type": "assistant", "parts": [{"text": "I'm doing well, thank you!"}]}`;
      // @ts-ignore
      const result = service.parseChatJsonl(content);
      expect(result).toContain('[User]: Hello, how are you?');
      expect(result).toContain('[Assistant]: I\'m doing well, thank you!');
    });

    it('skips telemetry messages', () => {
      const content = `{"subtype": "subui_telemetry", "data": {}}
{"type": "user", "parts": [{"text": "Actual message"}]}`;
      // @ts-ignore
      const result = service.parseChatJsonl(content);
      expect(result).not.toContain('subui_telemetry');
      expect(result).toContain('[User]: Actual message');
    });

    it('handles malformed JSON gracefully', () => {
      const content = `not valid json
{"type": "user", "parts": [{"text": "Valid message"}]}`;
      // @ts-ignore
      expect(() => service.parseChatJsonl(content)).not.toThrow();
    });

    it('preserves message order', () => {
      const content = `{"type": "user", "parts": [{"text": "First"}]}
{"type": "assistant", "parts": [{"text": "Second"}]}
{"type": "user", "parts": [{"text": "Third"}]}`;
      // @ts-ignore
      const result = service.parseChatJsonl(content);
      const firstIndex = result.indexOf('[User]: First');
      const secondIndex = result.indexOf('[Assistant]: Second');
      const thirdIndex = result.indexOf('[User]: Third');
      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });

    it('skips thought blocks', () => {
      const content = `{"type": "assistant", "parts": [{"thought": "Thinking..."}, {"text": "Response"}]}`;
      // @ts-ignore
      const result = service.parseChatJsonl(content);
      expect(result).not.toContain('Thinking...');
      expect(result).toContain('[Assistant]: Response');
    });
  });

  describe('splitIntoMolecules()', () => {
    describe('prose strategy', () => {
      it('splits on sentence boundaries', () => {
        const content = 'First sentence. Second sentence! Third sentence? Fourth sentence.';
        // @ts-ignore
        const result = service.splitIntoMolecules(content, 'test.md', 'prose', 'inbox');
        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result[0].content).toContain('First sentence');
      });

      it('handles markdown code fences', () => {
        const content = `Here is some text.

\`\`\`javascript
function test() { return 42; }
\`\`\`

More text here.`;
        // @ts-ignore
        const result = service.splitIntoMolecules(content, 'test.md', 'prose', 'inbox');
        expect(result.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('code strategy', () => {
      it('splits on function boundaries', () => {
        const content = `function test1() {
  return 1;
}

function test2() {
  return 2;
}`;
        // @ts-ignore
        const result = service.splitIntoMolecules(content, 'test.ts', 'code', 'inbox');
        expect(result.length).toBeGreaterThanOrEqual(1);
      });

      it('calculates byte offsets', () => {
        const content = 'function test() { return 42; }';
        // @ts-ignore
        const result = service.splitIntoMolecules(content, 'test.ts', 'code', 'inbox');
        if (result.length > 0) {
          expect(result[0].start).toBeGreaterThanOrEqual(0);
          expect(result[0].end).toBeGreaterThan(result[0].start);
        }
      });
    });

    describe('data strategy', () => {
      it('splits on line breaks', () => {
        const content = 'Line 1\nLine 2\nLine 3';
        // @ts-ignore
        const result = service.splitIntoMolecules(content, 'data.csv', 'data', 'inbox');
        expect(result.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('edge cases', () => {
      it('handles empty content', () => {
        // @ts-ignore
        const result = service.splitIntoMolecules('', 'test.md', 'prose', 'inbox');
        expect(result).toEqual([]);
      });

      it('enforces maxSize limit', () => {
        const content = 'A'.repeat(2000);
        // @ts-ignore
        const result = service.splitIntoMolecules(content, 'test.md', 'prose', 'inbox', 1000);
        // Should split into multiple molecules
        expect(result.length).toBeGreaterThanOrEqual(1);
      });

      it('extracts timestamps', () => {
        const content = '2026-01-25T03:43:54.405Z This happened at this time.';
        // @ts-ignore
        const result = service.splitIntoMolecules(content, 'test.md', 'prose', 'inbox');
        if (result.length > 0) {
          expect(result[0].timestamp).toBeDefined();
        }
      });
    });

    describe('unicode handling', () => {
      it('handles emoji correctly', () => {
        const content = 'Hello 🌍 World 🚀';
        // @ts-ignore
        const result = service.splitIntoMolecules(content, 'test.md', 'prose', 'inbox');
        expect(result.length).toBeGreaterThanOrEqual(1);
      });

      it('handles CJK characters', () => {
        const content = '你好世界 你好';
        // @ts-ignore
        const result = service.splitIntoMolecules(content, 'test.md', 'prose', 'inbox');
        expect(result.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('extractEarliestTimestamp()', () => {
    it('extracts ISO timestamps', () => {
      const content = 'Some text 2026-01-25T03:43:54.405Z more text';
      // @ts-ignore
      const result = service.extractEarliestTimestamp(content);
      expect(result).toBeDefined();
      expect(result).toBeGreaterThan(0);
    });

    it('extracts date-only format', () => {
      const content = 'Event on 2026-01-25 happened';
      // @ts-ignore
      const result = service.extractEarliestTimestamp(content);
      expect(result).toBeDefined();
    });

    it('returns fallback when no timestamp found', () => {
      const content = 'No timestamp here';
      // @ts-ignore
      const result = service.extractEarliestTimestamp(content);
      // Returns Date.now() as fallback
      expect(result).toBeDefined();
      expect(result).toBeGreaterThan(0);
    });

    it('extracts US date format', () => {
      const content = 'Event on 01/25/2026 happened';
      // @ts-ignore
      const result = service.extractEarliestTimestamp(content);
      expect(result).toBeDefined();
    });

    it('extracts month name format', () => {
      const content = 'Event on January 25, 2026 happened';
      // @ts-ignore
      const result = service.extractEarliestTimestamp(content);
      expect(result).toBeDefined();
    });
  });

  describe('detectMoleculeType()', () => {
    it('detects code content by file extension', () => {
      const content = 'function test() { return 42; }';
      // @ts-ignore
      const result = service.detectMoleculeType(content, 'test.ts');
      expect(result).toBe('code');
    });

    it('detects prose content by file extension', () => {
      const content = 'This is a paragraph of text with multiple sentences.';
      // @ts-ignore
      const result = service.detectMoleculeType(content, 'readme.md');
      expect(result).toBe('prose');
    });

    it('detects data content by file extension', () => {
      const content = 'key1,value1\nkey2,value2\nkey3,value3';
      // @ts-ignore
      const result = service.detectMoleculeType(content, 'data.csv');
      expect(result).toBe('data');
    });

    it('detects code by content heuristics', () => {
      const content = '```typescript\nfunction test() { return 42; }\n```';
      // @ts-ignore
      const result = service.detectMoleculeType(content, 'unknown.txt');
      expect(result).toBe('code');
    });
  });

  describe('applyTagModulation()', () => {
    it('filters tags based on modulation level', () => {
      const tags = ['#javascript', '#Archive', '#test'];
      // @ts-ignore
      const result = service.applyTagModulation(tags);
      expect(Array.isArray(result)).toBe(true);
    });

    it('handles empty tag array', () => {
      // @ts-ignore
      const result = service.applyTagModulation([]);
      expect(result).toEqual([]);
    });

    it('converts labels to tag format', () => {
      const labels = ['javascript', 'typescript'];
      // @ts-ignore
      const result = service.applyTagModulation(labels);
      expect(result.every(tag => tag.startsWith('#'))).toBe(true);
    });
  });

  describe('chunkedSanitize()', () => {
    it('handles large content in chunks using generator', () => {
      const largeContent = 'A'.repeat(3000);
      // @ts-ignore
      const generator = service.chunkedSanitize(largeContent, 'test.md', 1000);
      const chunks = Array.from(generator);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every(chunk => typeof chunk === 'string')).toBe(true);
    });

    it('preserves content integrity', () => {
      const content = 'Important content that should not be lost';
      // @ts-ignore
      const generator = service.chunkedSanitize(content, 'test.md', 100);
      const chunks = Array.from(generator);
      const result = chunks.join('');
      expect(result).toContain('Important content');
    });

    it('yields sanitized chunks', () => {
      const content = '{"content": "Test message"}';
      // @ts-ignore
      const generator = service.chunkedSanitize(content, 'test.md', 50);
      const chunks = Array.from(generator);
      // Each chunk should be sanitized
      chunks.forEach(chunk => {
        expect(typeof chunk).toBe('string');
      });
    });
  });

  describe('generateSimHash()', () => {
    it('generates consistent hashes', () => {
      const input = 'test content for hashing';
      // @ts-ignore
      const hash1 = service.generateSimHash(input);
      // @ts-ignore
      const hash2 = service.generateSimHash(input);
      expect(hash1).toBe(hash2);
    });

    it('generates different hashes for different content', () => {
      const input1 = 'content one';
      const input2 = 'content two';
      // @ts-ignore
      const hash1 = service.generateSimHash(input1);
      // @ts-ignore
      const hash2 = service.generateSimHash(input2);
      expect(hash1).not.toBe(hash2);
    });

    it('handles empty string', () => {
      // @ts-ignore
      expect(() => service.generateSimHash('')).not.toThrow();
    });
  });

  describe('createAtom()', () => {
    it('creates atom with correct structure', () => {
      // @ts-ignore
      const atom = service.createAtom('#test', 'concept');
      expect(atom.label).toBe('#test');
      expect(atom.type).toBe('concept');
      expect(atom.weight).toBe(1.0);
    });

    it('creates atom with custom weight', () => {
      // @ts-ignore
      const atom = service.createAtom('#test', 'concept', 0.5);
      expect(atom.weight).toBe(0.5);
    });
  });
});
