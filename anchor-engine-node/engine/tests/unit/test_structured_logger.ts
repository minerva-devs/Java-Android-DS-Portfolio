import { logWithContext, logger, metricsTracker } from '../../src/utils/structured-logger.js';
import winston from 'winston';
import Transport from 'winston-transport';

// Custom transport to capture logs
class TestTransport extends Transport {
  public logs: any[] = [];

  log(info: any, callback: () => void) {
    this.logs.push(info);
    callback();
  }

  clearLogs() {
    this.logs = [];
  }
}

async function testStructuredLogger() {
  console.log('--- Testing Structured Logger ---');

  const testTransport = new TestTransport();

  // Store original transport states and level to restore later
  const originalTransports = logger.transports.map(t => ({
    transport: t,
    silent: t.silent
  }));
  const originalLevel = logger.level;

  try {
    // Add test transport
    logger.add(testTransport);

    // Set level to 'silly' to capture all logs
    logger.level = 'silly';

    // Mute other transports to focus on our test transport output
    logger.transports.forEach(t => {
        if (t !== testTransport && t instanceof winston.transports.Console) {
            t.silent = true;
        }
    });

    let failureCount = 0;

    function assert(condition: boolean, message: string) {
      if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        failureCount++;
      } else {
        console.log(`✅ PASS: ${message}`);
      }
    }

    function assertLogMatch(predicate: (log: any) => boolean, message: string) {
      const match = testTransport.logs.find(predicate);
      if (!match) {
        console.error(`❌ FAIL: ${message}`);
        console.error('Captured logs:', JSON.stringify(testTransport.logs, null, 2));
        failureCount++;
      } else {
        console.log(`✅ PASS: ${message}`);
      }
      testTransport.clearLogs();
    }

    // Test 1: Info with context
    console.log('\nTesting logWithContext.info...');
    logWithContext.info('Test info message', { userId: 123, action: 'test' });
    assertLogMatch(log =>
      log.level === 'info' &&
      log.message === 'Test info message' &&
      log.context.userId === 123 &&
      log.module === 'structured-logger',
      'Info log should contain message and context'
    );

    // Test 2: Warn
    console.log('\nTesting logWithContext.warn...');
    logWithContext.warn('Test warn message', { warning: 'low disk' });
    assertLogMatch(log =>
      log.level === 'warn' &&
      log.message === 'Test warn message' &&
      log.context.warning === 'low disk',
      'Warn log should contain message and context'
    );

    // Test 3: Error
    console.log('\nTesting logWithContext.error...');
    const testError = new Error('Something went wrong');
    logWithContext.error('Test error message', testError, { errorId: 999 });
    assertLogMatch(log =>
      log.level === 'error' &&
      log.message === 'Test error message' &&
      log.error.message === 'Something went wrong' &&
      log.context.errorId === 999,
      'Error log should contain message, error object, and context'
    );

    // Test 4: Debug
    console.log('\nTesting logWithContext.debug...');
    logWithContext.debug('Test debug message', { debugInfo: 'xyz' });
    assertLogMatch(log =>
      log.level === 'debug' &&
      log.message === 'Test debug message' &&
      log.context.debugInfo === 'xyz',
      'Debug log should contain message and context'
    );

    // Test 5: Metrics recording via info
    console.log('\nTesting metrics via info...');
    metricsTracker.reset();
    logWithContext.info('Info with metrics', { metrics: { 'test_metric': 42 } });

    const metrics = metricsTracker.getAllMetrics();
    assert(metrics['test_metric']?.count === 1, 'Metric count should be 1');
    assert(metrics['test_metric']?.total === 42, 'Metric total should be 42');

    // Verify log also happened
    assertLogMatch(log =>
      log.message === 'Info with metrics',
      'Info log with metrics should still log message'
    );

    // Test 6: Performance
    console.log('\nTesting logWithContext.performance...');
    logWithContext.performance('db_query', 150, { queryId: 'q1' });

    const perfMetrics = metricsTracker.getAllMetrics();
    assert(perfMetrics['db_query']?.count === 1, 'Performance metric count should be 1');
    assert(perfMetrics['db_query']?.total === 150, 'Performance metric total should be 150');

    assertLogMatch(log =>
      log.message === 'PERFORMANCE_METRIC' &&
      log.operation === 'db_query' &&
      log.duration_ms === 150 &&
      log.context.queryId === 'q1',
      'Performance log should contain operation and duration'
    );

    // Test 7: Start Timer
    console.log('\nTesting logWithContext.startTimer...');
    const endTimer = logWithContext.startTimer('timer_test');
    await new Promise(resolve => setTimeout(resolve, 50));
    const duration = endTimer();

    assert(duration >= 40, 'Duration should be roughly correct (>= 40ms)'); // Using 40ms to be safe with timing jitter
    const timerMetrics = metricsTracker.getAllMetrics();
    assert(timerMetrics['timer_test']?.count === 1, 'Timer metric count should be 1');

    // Test 8: Ingestion
    console.log('\nTesting logWithContext.ingestion...');
    logWithContext.ingestion('success', { file: 'doc.pdf' });

    const ingestionMetrics = metricsTracker.getAllMetrics();
    assert(ingestionMetrics['ingestion_attempts']?.count === 1, 'Ingestion attempts should be recorded');
    assert(ingestionMetrics['ingestion_successes']?.count === 1, 'Ingestion successes should be recorded');

    assertLogMatch(log =>
      log.message === 'INGESTION_EVENT' &&
      log.status === 'success' &&
      log.details.file === 'doc.pdf',
      'Ingestion log should contain status and details'
    );

    // Test 9: Search
    console.log('\nTesting logWithContext.search...');
    logWithContext.search('search query', 10, 200, { userId: 'u1' });

    const searchMetrics = metricsTracker.getAllMetrics();
    assert(searchMetrics['search_queries']?.count === 1, 'Search queries count should be recorded');
    assert(searchMetrics['search_results']?.total === 10, 'Search results total should be recorded');

    assertLogMatch(log =>
      log.message === 'SEARCH_EVENT' &&
      log.query === 'search query' &&
      log.resultCount === 10 &&
      log.duration_ms === 200,
      'Search log should contain query stats'
    );

    // Test 10: Health
    console.log('\nTesting logWithContext.health...');
    logWithContext.health('healthy', { db: 'connected' });

    assertLogMatch(log =>
      log.message === 'HEALTH_EVENT' &&
      log.status === 'healthy' &&
      log.details.db === 'connected',
      'Health log should contain status and details'
    );

    if (failureCount > 0) {
      console.error(`\n❌ ${failureCount} tests failed.`);
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }
  } finally {
    // Cleanup: Remove test transport and restore original states
    try {
      logger.remove(testTransport);
      logger.level = originalLevel;
      originalTransports.forEach(({ transport, silent }) => {
        // Only modify if the transport is still attached to the logger
        if (logger.transports.includes(transport)) {
          transport.silent = silent;
        }
      });
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }
  }
}

testStructuredLogger().catch(e => {
  console.error('Test script error:', e);
  process.exit(1);
});
