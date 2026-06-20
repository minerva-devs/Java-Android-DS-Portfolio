import { VectorService } from '../../src/core/vector.js';
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';

const runTest = async () => {
    console.log('🧪 Testing VectorService...');

    // Setup - although currently VectorService forces Mock, we prepare for potential file ops
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-test-'));
    const dbPath = path.join(tempDir, 'anchor-db'); // VectorService uses dirname(dbPath)
    process.env.PGLITE_DB_PATH = dbPath;

    try {
        const service = new VectorService();

        // Test 1: Instantiation
        console.log('1. Verifying initial state...');
        assert.equal(service.isInitialized, false, 'Service should not be initialized on creation');

        // Test 2: Methods throw before init
        console.log('2. Verifying uninitialized guards...');
        try {
            service.add(1, [0.1]);
            assert.fail('add() should throw before initialization');
        } catch (e: any) {
            assert.match(e.message, /not initialized/);
        }

        try {
            service.search([0.1]);
            assert.fail('search() should throw before initialization');
        } catch (e: any) {
            assert.match(e.message, /not initialized/);
        }

        // Test 3: Initialization
        console.log('3. Verifying initialization...');
        await service.init();
        assert.equal(service.isInitialized, true, 'Service should be initialized after init()');

        // Test 4: Add Operation (Mock)
        console.log('4. Verifying add() operation...');
        const vector = new Float32Array(768).fill(0.5);
        // Should not throw
        service.add(123, vector);

        // Test 5: Search Operation (Mock)
        console.log('5. Verifying search() operation...');
        const searchRes = service.search(vector, 10);
        assert.ok(searchRes, 'Search result should be defined');
        assert.deepEqual(searchRes, { ids: [], distances: [] }, 'Mock search should return empty result');

        // Test 6: Save (Mock)
        console.log('6. Verifying save() operation...');
        // Should not throw
        service.save();

        // Test 7: Close
        console.log('7. Verifying close()...');
        service.close();
        assert.equal(service.isInitialized, false, 'Service should be uninitialized after close()');

        console.log('✅ All VectorService tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

runTest();
