
import { processInBatches } from '../../src/core/batch.js';

// Test runner helper
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
    try {
        process.stdout.write(`  ${name}... `);
        await fn();
        console.log('✅ PASS');
        passed++;
    } catch (e: any) {
        console.log('❌ FAIL');
        console.error(`     └─ ${e.message}`);
        failed++;
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function assertEqual(actual: any, expected: any, message: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message}. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

async function runTests() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║     BATCH PROCESSING TESTS             ║');
    console.log('╚════════════════════════════════════════╝\n');

    // 1. Basic Processing
    await test('should process items in correct batch sizes', async () => {
        const items = [1, 2, 3, 4, 5, 6, 7];
        const batchSize = 3;
        const batches: number[][] = [];

        await processInBatches(items, async (batch) => {
            batches.push(batch);
            return batch;
        }, { batchSize });

        assertEqual(batches.length, 3, 'Should have processed 3 batches');
        assertEqual(batches[0], [1, 2, 3], 'First batch correct');
        assertEqual(batches[1], [4, 5, 6], 'Second batch correct');
        assertEqual(batches[2], [7], 'Last batch correct');
    });

    // 2. Indices
    await test('should pass correct indices to processor', async () => {
        const items = ['a', 'b', 'c', 'd', 'e'];
        const batchSize = 2;
        const indexLog: { batchIndex: number, startItemIndex: number }[] = [];

        await processInBatches(items, async (_batch, batchIndex, startItemIndex) => {
            indexLog.push({ batchIndex, startItemIndex });
            return true;
        }, { batchSize });

        assertEqual(indexLog[0], { batchIndex: 0, startItemIndex: 0 }, 'First batch indices');
        assertEqual(indexLog[1], { batchIndex: 1, startItemIndex: 2 }, 'Second batch indices');
        assertEqual(indexLog[2], { batchIndex: 2, startItemIndex: 4 }, 'Third batch indices');
    });

    // 3. Results Accumulation
    await test('should accumulate results correctly', async () => {
        const items = [1, 2, 3, 4];

        const results = await processInBatches(items, async (batch) => {
            return batch.reduce((sum, n) => sum + n, 0);
        }, { batchSize: 2 });

        // Batches: [1, 2] -> sum 3, [3, 4] -> sum 7
        assertEqual(results, [3, 7], 'Results should match sum of batches');
    });

    // 4. Empty Input
    await test('should handle empty input', async () => {
        let called = false;
        const results = await processInBatches([], async () => {
            called = true;
            return 'never';
        }, { batchSize: 5 });

        assert(!called, 'Processor should not be called for empty input');
        assertEqual(results, [], 'Should return empty array');
    });

    // 5. Delay Logic
    await test('should respect delay between batches', async () => {
        const items = [1, 2, 3, 4];
        const delayMs = 50; // Use small delay
        const start = Date.now();

        // 2 batches -> 1 delay (after first batch)
        await processInBatches(items, async () => {
            return true;
        }, { batchSize: 2, delayMs });

        const duration = Date.now() - start;
        // Should be at least 50ms (plus some execution overhead)
        assert(duration >= delayMs, `Duration ${duration}ms should be >= delay ${delayMs}ms`);
        // Should not be excessively long (e.g. > 200ms) unless system is very slow
        // assert(duration < delayMs * 3, `Duration ${duration}ms is unexpectedly long`);
    });

    // 6. Error Propagation
    await test('should propagate errors from processor', async () => {
        const items = [1, 2];
        let error: Error | undefined;

        try {
            await processInBatches(items, async () => {
                throw new Error('Test Error');
            }, { batchSize: 1 });
        } catch (e: any) {
            error = e;
        }

        assert(!!error, 'Should have thrown error');
        assert(error?.message === 'Test Error', 'Should propagate specific error');
    });

    // 7. Batch > Length
    await test('should handle batch size larger than input', async () => {
        const items = [1, 2, 3];
        const batches: number[][] = [];

        await processInBatches(items, async (batch) => {
            batches.push(batch);
            return true;
        }, { batchSize: 10 });

        assertEqual(batches.length, 1, 'Should process as single batch');
        assertEqual(batches[0], [1, 2, 3], 'Batch content correct');
    });

    console.log('\n╔════════════════════════════════════════╗');
    console.log(`║  Results: ${passed} passed, ${failed} failed`.padEnd(41) + '║');
    console.log('╚════════════════════════════════════════╝\n');

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
    console.error('Test suite crashed:', e);
    process.exit(1);
});
