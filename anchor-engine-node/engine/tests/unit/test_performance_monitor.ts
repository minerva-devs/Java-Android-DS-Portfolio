
import { performanceMonitor } from '../../src/utils/performance-monitor.js';

// Helper for assertions
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ FAIL: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`❌ FAIL: ${message} (Expected ${expected}, got ${actual})`);
  }
}

async function testPerformanceMonitor() {
  console.log('--- Testing Performance Monitor ---');

  // Test 1: Basic Operations (startOperation, recordOperation)
  {
    console.log('Test 1: Basic Operations');
    performanceMonitor.reset();

    const endOp = performanceMonitor.startOperation('test_op_1');
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
    endOp();

    const metric = performanceMonitor.getMetric('test_op_1');
    assert(!!metric, 'Metric test_op_1 should exist');
    assertEquals(metric!.count, 1, 'Count should be 1');
    assert(metric!.totalDuration >= 0, 'Total duration should be >= 0');

    // recordOperation
    performanceMonitor.recordOperation('test_op_2', 50);
    const metric2 = performanceMonitor.getMetric('test_op_2');
    assert(!!metric2, 'Metric test_op_2 should exist');
    assertEquals(metric2!.count, 1, 'Count should be 1');
    assertEquals(metric2!.totalDuration, 50, 'Total duration should be 50');
    assertEquals(metric2!.averageDuration, 50, 'Average duration should be 50');

    console.log('✅ PASS: Basic Operations');
  }

  // Test 2: Multiple Calls & Stats Calculation
  {
    console.log('Test 2: Multiple Calls & Stats');
    performanceMonitor.reset();

    performanceMonitor.recordOperation('op_stats', 10);
    performanceMonitor.recordOperation('op_stats', 20);
    performanceMonitor.recordOperation('op_stats', 30);

    const metric = performanceMonitor.getMetric('op_stats')!;
    assertEquals(metric.count, 3, 'Count should be 3');
    assertEquals(metric.totalDuration, 60, 'Total duration should be 60');
    assertEquals(metric.averageDuration, 20, 'Average duration should be 20');
    assertEquals(metric.minDuration, 10, 'Min duration should be 10');
    assertEquals(metric.maxDuration, 30, 'Max duration should be 30');

    console.log('✅ PASS: Multiple Calls & Stats');
  }

  // Test 3: recordMetric
  {
    console.log('Test 3: recordMetric');
    performanceMonitor.reset();

    performanceMonitor.recordMetric('custom_metric', 100);
    const metric = performanceMonitor.getMetric('custom_metric')!;
    assertEquals(metric.count, 1, 'Count should be 1');
    assertEquals(metric.totalDuration, 100, 'Value should be 100');

    console.log('✅ PASS: recordMetric');
  }

  // Test 4: Get All Metrics & Stats
  {
    console.log('Test 4: Get All Metrics & Stats');
    performanceMonitor.reset();

    performanceMonitor.recordOperation('op_A', 10);
    performanceMonitor.recordOperation('op_B', 20);

    const allMetrics = performanceMonitor.getAllMetrics();
    const keys = Object.keys(allMetrics);
    assert(keys.includes('op_A'), 'Should include op_A');
    assert(keys.includes('op_B'), 'Should include op_B');

    const allStats = performanceMonitor.getAllStats();
    assert(allStats['op_A'].count === 1, 'Stats should have correct count');

    console.log('✅ PASS: Get All Metrics');
  }

  // Test 5: Slowest & Busiest
  {
    console.log('Test 5: Slowest & Busiest');
    performanceMonitor.reset();

    // op_slow: avg 100
    performanceMonitor.recordOperation('op_slow', 100);
    // op_fast: avg 10
    performanceMonitor.recordOperation('op_fast', 10);

    // op_busy: count 5
    for(let i=0; i<5; i++) performanceMonitor.recordOperation('op_busy', 1);
    // op_rare: count 1
    performanceMonitor.recordOperation('op_rare', 1);

    const slowest = performanceMonitor.getSlowestOperations(1);
    assertEquals(slowest[0].operation, 'op_slow', 'Slowest should be op_slow');

    const busiest = performanceMonitor.getBusiestOperations(1);
    assertEquals(busiest[0].operation, 'op_busy', 'Busiest should be op_busy');

    console.log('✅ PASS: Slowest & Busiest');
  }

  // Test 6: System Stats
  {
    console.log('Test 6: System Stats');
    const stats = performanceMonitor.getSystemStats();
    assert(!!stats.memory, 'Should have memory stats');
    assert(stats.uptime > 0, 'Should have uptime');

    console.log('✅ PASS: System Stats');
  }

  // Test 7: Prune Old Metrics (Testing the bug fix)
  {
    console.log('Test 7: Prune Old Metrics (Recent)');
    performanceMonitor.reset();

    performanceMonitor.recordOperation('active_op', 50);

    // Run prune
    performanceMonitor.pruneOldMetrics();

    const metric = performanceMonitor.getMetric('active_op');
    if (!metric) {
        throw new Error('❌ FAIL: active_op was incorrectly pruned!');
    } else {
        console.log('✅ PASS: active_op was NOT pruned');
    }
  }

  // Test 8: Prune Old Metrics (Actually Old)
  {
    console.log('Test 8: Prune Old Metrics (Actually Old)');
    performanceMonitor.reset();

    performanceMonitor.recordOperation('old_op', 50);

    // Manually set lastUpdated to the past
    const metric = performanceMonitor.getMetric('old_op')!;
    // 11 minutes ago (TTL is 10 minutes)
    metric.lastUpdated = Date.now() - (11 * 60 * 1000);

    performanceMonitor.pruneOldMetrics();

    const prunedMetric = performanceMonitor.getMetric('old_op');
    if (prunedMetric) {
        throw new Error('❌ FAIL: old_op should have been pruned');
    } else {
        console.log('✅ PASS: old_op was pruned');
    }
  }

  // Test 9: Max Metrics Limit
  {
    console.log('Test 9: Max Metrics Limit');
    performanceMonitor.reset();

    const MAX_METRICS = 1000;

    // Add MAX_METRICS + 10
    // We start from 1 to avoid confusion with index
    for(let i=1; i<=MAX_METRICS + 10; i++) {
        performanceMonitor.recordOperation(`op_${i}`, 1);
    }

    assert(performanceMonitor.getAllStats()['op_1'] !== undefined, 'op_1 should exist before prune');

    performanceMonitor.pruneOldMetrics();

    const allMetrics = performanceMonitor.getAllMetrics();
    assertEquals(Object.keys(allMetrics).length, MAX_METRICS, 'Should have exactly MAX_METRICS');

    // Since it iterates over keys and deletes from start, and keys are insertion order,
    // it should delete op_1 to op_10.
    assert(!performanceMonitor.getMetric('op_1'), 'op_1 should be pruned');
    assert(!!performanceMonitor.getMetric(`op_${MAX_METRICS + 5}`), 'Newer metric should exist');

    console.log('✅ PASS: Max Metrics Limit');
  }
}

testPerformanceMonitor().catch(e => {
  console.error(e);
  process.exit(1);
});
