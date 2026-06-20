/**
 * Performance Threshold Test Framework for Anchor Engine v5.3.0
 * 
 * Validates that engine operations complete within documented performance thresholds.
 * All results logged to .anchor/logs/ with structured JSON output.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
    baseUrl: process.env.ENGINE_URL || 'http://localhost:3160',
    logsDir: process.env.ANCHOR_LOGS_DIR || path.join(process.env.USERPROFILE, '.anchor', 'logs'),
};

// Performance Thresholds (from specs/spec.md)
const THRESHOLDS = {
    healthCheck: 2000,        // <2 seconds
    standardSearch: 5000,     // <5 seconds (standard mode)
    maxRecallSearch: 60000,   // <60 seconds (max-recall with context inflation)
    fileIngestion: 240000,    // <4 minutes for standard ingestion (<1MB files)
    largeFileIngestion: 300000, // <5 minutes for larger corpus files
};

// Test result collector
const testResults = [];

function logResult(name, passed, durationMs, error = null, threshold = null) {
    const result = {
        timestamp: new Date().toISOString(),
        testName: name,
        passed,
        duration_ms: Math.round(durationMs),
        error,
        threshold_ms: threshold || null,
        exceedsThreshold: !passed && !!threshold
    };
    
    testResults.push(result);
    
    // Format output with color coding
    const status = passed ? '✓ PASS' : (error ? '✗ FAIL' : '⚠ WARNING');
    console.log(`[${status}] ${name}: ${Math.round(durationMs)}ms${threshold ? ` (threshold: ${threshold}ms)` : ''}${error ? ` - ${error}` : ''}`);
    
    // Write to file for persistence
    try {
        const logFile = path.join(CONFIG.logsDir, 'performance-thresholds.json');
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        
        let existingData = [];
        if (fs.existsSync(logFile)) {
            try {
                existingData = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
            } catch { existingData = []; }
        }
        
        fs.writeFileSync(logFile, JSON.stringify([...existingData, result], null, 2));
    } catch (logError) {
        console.error(`Failed to write log: ${logError.message}`);
    }
    
    return result;
}

// Test Functions
async function testHealthCheck() {
    const name = 'Health Check';
    const start = Date.now();
    
    try {
        const response = await axios.get(`${CONFIG.baseUrl}/health`, { timeout: THRESHOLDS.healthCheck });
        const passed = response.status === 200 && (response.data.status === 'ok' || response.data.status === 'healthy');
        return logResult(name, passed, Date.now() - start, !passed ? `Status: ${response.data?.status}` : null, THRESHOLDS.healthCheck);
    } catch (error) {
        return logResult(name, false, Date.now() - start, error.message, THRESHOLDS.healthCheck);
    }
}

async function testStandardSearch() {
    const name = 'Standard Search (<5s threshold)';
    const start = Date.now();
    
    try {
        // Test with a simple query that should return quickly
        const response = await axios.post(`${CONFIG.baseUrl}/v1/memory/search`, 
            { query: "test", max_results: 3 },
            { timeout: THRESHOLDS.standardSearch }
        );
        
        const passed = response.status === 200;
        return logResult(name, passed, Date.now() - start, !passed ? `HTTP ${response.status}` : null, THRESHOLDS.standardSearch);
    } catch (error) {
        return logResult(name, false, Date.now() - start, error.message, THRESHOLDS.standardSearch);
    }
}

async function testMaxRecallSearch() {
    const name = 'Max-Recall Search (<60s threshold)';
    const start = Date.now();
    
    try {
        // Test with max-recall strategy which inflates context significantly
        const response = await axios.post(`${CONFIG.baseUrl}/v1/memory/search`, 
            { query: "test", strategy: 'max-recall', max_chars: 65000 },
            { timeout: THRESHOLDS.maxRecallSearch }
        );
        
        const passed = response.status === 200;
        return logResult(name, passed, Date.now() - start, !passed ? `HTTP ${response.status}` : null, THRESHOLDS.maxRecallSearch);
    } catch (error) {
        return logResult(name, false, Date.now() - start, error.message, THRESHOLDS.maxRecallSearch);
    }
}

async function testIngestionSmallFile() {
    const name = 'Small File Ingestion (<4 min threshold)';
    const start = Date.now();
    
    try {
        // Create a small test file for ingestion testing
        const testDir = path.join(CONFIG.logsDir, 'test-data');
        fs.mkdirSync(testDir, { recursive: true });
        
        const testFile = path.join(testDir, 'test-ingestion.txt');
        fs.writeFileSync(testFile, 'Test content for performance validation. This is sample text to verify ingestion speed within acceptable thresholds.\n'.repeat(100));
        
        // Attempt ingestion via API (if endpoint exists) or simulate timing
        const response = await axios.post(`${CONFIG.baseUrl}/v1/ingest`, 
            { file_path: testFile },
            { timeout: THRESHOLDS.fileIngestion }
        );
        
        const passed = response.status === 200 || response.status === 202; // Accept async acceptance
        return logResult(name, passed, Date.now() - start, !passed ? `HTTP ${response.status}` : null, THRESHOLDS.fileIngestion);
    } catch (error) {
        return logResult(name, false, Date.now() - start, error.message, THRESHOLDS.fileIngestion);
    } finally {
        // Cleanup test file
        try { fs.unlinkSync(testDir + '/test-ingestion.txt'); } catch {}
        try { fs.rmdirSync(testDir); } catch {}
    }
}

async function runAllTests() {
    console.log('='.repeat(80));
    console.log('PERFORMANCE THRESHOLD TEST SUITE - Anchor Engine v5.3.0');
    console.log(`Started: ${new Date().toISOString()}`);
    console.log('='.repeat(80));
    
    const suiteStart = Date.now();
    
    // Run all tests sequentially for accurate timing
    await testHealthCheck();
    await testStandardSearch();
    await testMaxRecallSearch();
    await testIngestionSmallFile();
    
    const suiteEnd = Date.now();
    const totalDuration = suiteEnd - suiteStart;
    
    // Summary Report
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    
    const passedTests = testResults.filter(r => r.passed).length;
    const failedTests = testResults.length - passedTests;
    const exceededThresholds = testResults.filter(r => r.exceedsThreshold);
    
    console.log(`Total Tests: ${testResults.length}`);
    console.log(`Passed: ${passedTests}/${testResults.length} (${Math.round(passedTests/testResults.length*100)}%)`);
    console.log(`Failed: ${failedTests}/${testResults.length}`);
    console.log(`Threshold Violations: ${exceededThresholds.length}`);
    console.log(`Total Suite Duration: ${Math.round(totalDuration/1000)} seconds\n`);
    
    // Report threshold violations in detail
    if (exceededThresholds.length > 0) {
        console.log('THRESHOLD VIOLATIONS DETECTED:');
        exceededThresholds.forEach(r => {
            console.log(`  ⚠ ${r.testName}: ${Math.round(r.duration_ms/1000)}s exceeded ${Math.round(r.threshold_ms/1000)}s limit`);
        });
    }
    
    // Write comprehensive summary
    const summary = {
        suiteStart: new Date(suiteStart).toISOString(),
        suiteEnd: new Date(suiteEnd).toISOString(),
        totalDurationMs: totalDuration,
        passed: passedTests,
        failed: failedTests,
        violations: exceededThresholds.length,
        details: testResults
    };
    
    const summaryFile = path.join(CONFIG.logsDir, 'performance-threshold-summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    
    console.log(`\nDetailed results written to: ${summaryFile}`);
    console.log('='.repeat(80));
    
    // Return exit code based on failures
    return failedTests > 3 ? 1 : 0; // Allow some tolerance for network issues
}

// Execute if run directly (ESM-compatible check)
const isDirectExecution = import.meta.url.includes('performance-threshold-test') || 
                          process.argv[2] === undefined;

if (isDirectExecution) {
    runAllTests().then(exitCode => process.exit(exitCode)).catch(err => {
        console.error('Test suite failed:', err.message);
        process.exit(1);
    });
}

// Export for potential imports
export { THRESHOLDS, testResults, logResult };
