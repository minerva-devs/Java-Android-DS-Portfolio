
import { extractTemporalContext } from '../../src/services/search/query-parser.js';

async function testTemporalLimit() {
    console.log('--- Testing Temporal Context Limit ---');

    const maxLimit = 100; // The limit we plan to implement (plus current year, plus small buffer)

    // Case 1: Huge number of years
    {
        const hugeAmount = 10000;
        const query = `last ${hugeAmount} years`;

        console.log(`Testing query: "${query}"`);
        const start = Date.now();
        const tags = extractTemporalContext(query);
        const duration = Date.now() - start;

        console.log(`Generated ${tags.length} tags in ${duration}ms`);

        // We expect tags count to be capped around 100 + 1 (current year).
        // Let's say < 150 to be safe.
        if (tags.length > 150) {
            console.error(`❌ FAIL: Generated too many tags (${tags.length}). Expected around ${maxLimit}.`);
            process.exit(1);
        } else {
            console.log(`✅ PASS: Tag count is within safe limits.`);
        }
    }

    // Case 2: Huge number of months
    {
        const hugeAmount = 100000; // 100k months is ~8000 years
        const query = `last ${hugeAmount} months`;

        console.log(`Testing query: "${query}"`);
        const start = Date.now();
        const tags = extractTemporalContext(query);
        const duration = Date.now() - start;

        console.log(`Generated ${tags.length} tags in ${duration}ms`);

        if (tags.length > 150) {
             console.error(`❌ FAIL: Generated too many tags (${tags.length}). Expected around ${maxLimit}.`);
             process.exit(1);
        } else {
            console.log(`✅ PASS: Tag count is within safe limits.`);
        }
    }
}

testTemporalLimit().catch(e => {
    console.error(e);
    process.exit(1);
});
