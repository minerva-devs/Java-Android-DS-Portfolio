#!/usr/bin/env node
/**
 * Centralized Test Logger - JavaScript Version
 *
 * Captures all test output into a single log file per test run.
 * Logs are stored in /logs/tests/ and truncated to last 10,000 lines.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', 'logs', 'tests');
const MAX_LOG_LINES = 10000;

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

class TestLogger {
  constructor(options) {
    this.startTime = Date.now();
    this.testName = options.testName;
    this.testPath = options.testPath;
    this.metadata = options.metadata || {};
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const hash = createHash('md5').update(`${timestamp}-${options.testName}`).digest('hex').slice(0, 8);
    this.logFile = path.join(LOGS_DIR, `${options.testName}-${timestamp}-${hash}.log`);
    
    this.entries = [];
    this.captureConsole();
    this.log('info', 'Test logger initialized', { testName: this.testName, logFile: this.logFile });
  }
  
  captureConsole() {
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;
    const origDebug = console.debug;
    
    console.log = (...args) => {
      this.log('info', args.map(a => this.formatValue(a)).join(' '));
      origLog.apply(console, args);
    };
    
    console.error = (...args) => {
      this.log('error', args.map(a => this.formatValue(a)).join(' '));
      origError.apply(console, args);
    };
    
    console.warn = (...args) => {
      this.log('warn', args.map(a => this.formatValue(a)).join(' '));
      origWarn.apply(console, args);
    };
    
    console.debug = (...args) => {
      this.log('debug', args.map(a => this.formatValue(a)).join(' '));
      origDebug.apply(console, args);
    };
  }
  
  formatValue(value) {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return `${value.message}\n${value.stack}`;
    if (typeof value === 'object' && value !== null) {
      try { return JSON.stringify(value, null, 2); }
      catch { return String(value); }
    }
    return String(value);
  }
  
  log(level, message, data) {
    this.entries.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    });
  }
  
  info(message, data) { this.log('info', message, data); }
  error(message, data) { this.log('error', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  debug(message, data) { this.log('debug', message, data); }
  
  end(exitCode = 0, results) {
    this.restoreConsole();
    const duration = Date.now() - this.startTime;
    
    this.log('info', 'Test run completed', { exitCode, duration: `${duration}ms`, results });
    this.writeLogFile(exitCode, duration, results);
    this.truncateLogFile();
    
    console.log(`\n✅ Test log written to: ${this.logFile}`);
  }
  
  writeLogFile(exitCode, duration, results) {
    const lines = [];
    lines.push('='.repeat(80));
    lines.push('TEST RUN LOG');
    lines.push('='.repeat(80));
    lines.push(`Test Name: ${this.testName}`);
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push(`Duration:  ${duration}ms`);
    lines.push(`Exit Code: ${exitCode}`);
    lines.push('');
    
    if (results) {
      lines.push('RESULTS:');
      lines.push(`  Passed:  ${results.passed}`);
      lines.push(`  Failed:  ${results.failed}`);
      lines.push(`  Total:   ${results.total}`);
      lines.push('');
    }
    
    lines.push('LOG ENTRIES:');
    lines.push('-'.repeat(80));
    
    for (const entry of this.entries) {
      const ts = entry.timestamp.slice(11, 26);
      const level = `[${entry.level.toUpperCase()}]`;
      if (entry.data) {
        lines.push(`${ts} ${level} ${entry.message}`);
        lines.push(`  ${JSON.stringify(entry.data, null, 2)}`);
      } else {
        lines.push(`${ts} ${level} ${entry.message}`);
      }
    }
    
    lines.push('='.repeat(80));
    lines.push('END OF LOG');
    lines.push('='.repeat(80));
    
    fs.writeFileSync(this.logFile, lines.join('\n'), 'utf-8');
  }
  
  truncateLogFile() {
    try {
      const content = fs.readFileSync(this.logFile, 'utf-8');
      const lines = content.split('\n');
      if (lines.length > MAX_LOG_LINES) {
        fs.writeFileSync(this.logFile, lines.slice(-MAX_LOG_LINES).join('\n'), 'utf-8');
      }
    } catch (e) {}
  }
  
  restoreConsole() {
    console.log = console.log.__original || console.log;
    console.error = console.error.__original || console.error;
  }
  
  getLogFile() { return this.logFile; }
}

function createTestLogger(options) {
  return new TestLogger(options);
}

export { createTestLogger, TestLogger };
export default { createTestLogger, TestLogger };
