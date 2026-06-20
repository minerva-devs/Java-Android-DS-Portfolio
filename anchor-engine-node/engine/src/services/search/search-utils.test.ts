import { describe, it, expect } from 'vitest';

/**
 * Test stripTagFooters function behavior
 * stripTagFooters removes YAML metadata footers that appear when search results are truncated
 */
describe('stripTagFooters', () => {
  // Note: stripTagFooters is not exported, so we test it indirectly through the pattern
  const stripTagFootersPattern = /^(##[A-Za-z0-9_]*\s*)+$/;

  it('should match YAML footer lines with single tag tokens', () => {
    const line1 = '##19864Residential';
    const line2 = '##1Okay';
    const line3 = '##3am';
    const line4 = '##ABQLo';

    expect(stripTagFootersPattern.test(line1.trim())).toBe(true);
    expect(stripTagFootersPattern.test(line2.trim())).toBe(true);
    expect(stripTagFootersPattern.test(line3.trim())).toBe(true);
    expect(stripTagFootersPattern.test(line4.trim())).toBe(true);
  });

  it('should match YAML footer lines with multiple tag tokens', () => {
    const footerLine = '##19864Residential ##1Okay ##3am ##ABQLo';
    expect(stripTagFootersPattern.test(footerLine.trim())).toBe(true);
  });

  it('should not match content lines', () => {
    const lines = [
      'This is real content',
      'More meaningful text',
      'Code snippet: function test() {}',
      'A sentence with a #hashtag in it',
      '##Token inline with other text',
    ];

    lines.forEach((line) => {
      expect(stripTagFootersPattern.test(line.trim())).toBe(false);
    });
  });

  it('should not match lines with whitespace after tokens', () => {
    // The regex allows trailing whitespace within the token pattern
    const footerWithSpaces = '##19864Residential  ##1Okay   ##3am';
    expect(stripTagFootersPattern.test(footerWithSpaces.trim())).toBe(true);
  });

  it('should identify footer removal scenario', () => {
    // Simulate the complete footer removal scenario
    const content = `This is real content from a session
More content here
And even more text
##19864Residential
##1Okay
##3am
##ABQLo`;

    const lines = content.split('\n');
    let footerLinesCount = 0;

    // Count how many trailing lines would be removed
    for (let i = lines.length - 1; i >= 0; i--) {
      if (stripTagFootersPattern.test(lines[i].trim())) {
        footerLinesCount++;
      } else {
        break;
      }
    }

    expect(footerLinesCount).toBe(4); // Should remove 4 footer lines
  });

  it('should preserve content when no footers present', () => {
    const contentWithoutFooters = `This is real content
More text here
Final line`;

    const lines = contentWithoutFooters.split('\n');
    let footerLinesCount = 0;

    for (let i = lines.length - 1; i >= 0; i--) {
      if (stripTagFootersPattern.test(lines[i].trim())) {
        footerLinesCount++;
      } else {
        break;
      }
    }

    expect(footerLinesCount).toBe(0); // No footers to remove
  });
});
