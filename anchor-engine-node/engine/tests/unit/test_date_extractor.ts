
import { extractDateFromContent } from '../../src/utils/date_extractor.js';
import { config } from '../../src/config/index.js';

async function testDateExtractor() {
    console.log('--- Testing Date Extractor ---');
    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, message: string) {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
            failed++;
        }
    }

    function assertDate(text: string, expectedDateStr: string | null, message: string) {
        const result = extractDateFromContent(text);
        if (expectedDateStr === null) {
            if (result === null) {
                console.log(`✅ PASS: ${message}`);
                passed++;
            } else {
                console.error(`❌ FAIL: ${message}. Expected null, got ${new Date(result).toISOString()}`);
                failed++;
            }
        } else {
            if (result === null) {
                console.error(`❌ FAIL: ${message}. Expected ${expectedDateStr}, got null`);
                failed++;
            } else {
                const resultDate = new Date(result);
                // Compare just the date part if possible, or accept that time might be 00:00:00 UTC
                // Date.parse usually returns UTC midnight for ISO dates, but local time for others?
                // Actually Date.parse('2025-01-24') is UTC.
                // Date.parse('01/24/2025') is usually local time in some browsers/Node versions.
                // Let's check strict equality first, or check if it matches meaningful date.

                // For simplicity, let's compare parsed timestamps of the expected string vs result
                const expected = Date.parse(expectedDateStr);

                // If Date.parse behavior differs for input format vs expected format, we might have issues.
                // But extractDateFromContent uses Date.parse(match[0]).
                // So if we pass expectedDateStr as the exact string matched, it should match.

                // But wait, the function returns a number (timestamp).
                // If I pass '2025-01-24' as input, it finds '2025-01-24'.
                // It returns Date.parse('2025-01-24').
                // So I should expect Date.parse('2025-01-24').

                if (result === expected) {
                     console.log(`✅ PASS: ${message}`);
                     passed++;
                } else {
                    // Try to be lenient on timezone if off by small amount?
                    // But unit tests should be deterministic.
                    // If the function returns Date.parse(match), then we expect Date.parse(match).
                    console.error(`❌ FAIL: ${message}. Expected ${expected} (${expectedDateStr}), got ${result} (${new Date(result).toISOString()})`);
                    failed++;
                }
            }
        }
    }

    // 1. ISO 8601
    assertDate('2025-01-24', '2025-01-24', 'ISO 8601 (YYYY-MM-DD)');
    assertDate('2025/01/24', '2025/01/24', 'ISO 8601 (YYYY/MM/DD)');

    // 2. US Format
    assertDate('01/24/2025', '01/24/2025', 'US Format (MM/DD/YYYY)');
    assertDate('01-24-2025', '01-24-2025', 'US Format (MM-DD-YYYY)');

    // 3. Textual Format
    assertDate('Jan 24, 2025', 'Jan 24, 2025', 'Textual (Jan 24, 2025)');
    // We expect the extractor to handle ordinal suffixes, so we compare against the cleaned date string
    assertDate('January 24th, 2025', 'January 24, 2025', 'Textual (January 24th, 2025)');

    // 4. Embedded in text
    assertDate('This document was created on 2025-01-24 by the user.', '2025-01-24', 'Date embedded in text');

    // 5. Scan limit
    // Create a string longer than limit with date at the end
    const limit = config.LIMITS.DATE_EXTRACTOR_SCAN_LIMIT;
    const filler = 'a'.repeat(limit + 10);
    const hiddenDate = filler + '2025-01-24';
    assertDate(hiddenDate, null, 'Date beyond scan limit should be ignored');

    // 6. Date just within limit
    // Date at the very end of the limit
    // We use spaces as filler to ensure word boundary (\b) matches at the start of the date
    const filler2 = ' '.repeat(limit - 10);
    const visibleDate = filler2 + '2025-01-24';
    // The substring(0, limit) will include the date.
    assertDate(visibleDate, '2025-01-24', 'Date within scan limit should be found');

    // 7. Invalid dates
    // Date.parse('2025-13-32') might behave differently across Node versions.
    // In many environments, it returns NaN.
    const invalidDate = extractDateFromContent('2025-13-32');
    // Note: 2025-13-32 might not match the regex exactly or Date.parse might handle it.
    // The regex is \d{4}[-/]\d{1,2}[-/]\d{1,2}
    // So it matches '2025-13-32'.
    // Date.parse('2025-13-32') returns NaN in Chrome/Node usually.
    if (invalidDate === null) {
         console.log(`✅ PASS: Invalid date (2025-13-32) returns null`);
         passed++;
    } else {
        console.error(`❌ FAIL: Invalid date (2025-13-32) returned ${invalidDate} (should be null)`);
        failed++;
    }

    // 8. No date
    assertDate('No date here', null, 'Text with no date');

    // 9. Empty string
    assertDate('', null, 'Empty string');

    console.log('-----------------------------------');
    console.log(`Tests Completed: ${passed} Passed, ${failed} Failed`);

    if (failed > 0) {
        process.exit(1);
    }
}

testDateExtractor().catch(e => {
    console.error(e);
    process.exit(1);
});
