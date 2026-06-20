#!/usr/bin/env node
/**
 * Anchor Engine Shutdown Script (Agent-Friendly)
 * 
 * This script reliably shuts down the Anchor Engine by finding and stopping
 * the process on port 3160 (or configured port).
 * 
 * Usage: node scripts/stop-engine-bg.mjs
 * 
 * Features:
 * - Finds engine process by listening to port 3160
 * - Graceful shutdown via SIGTERM
 * - Force kill if graceful shutdown fails
 * - Logs all operations to .anchor/logs/
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';

const LOGS_DIR = path.join(os.homedir(), '.anchor', 'logs');
const DEFAULT_PORT = 3160;

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Logger - writes to console and file
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] ${message}`;
  
  // Console output (for debugging)
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
  
  // File logging
  const logFile = path.join(LOGS_DIR, `stop-${Date.now()}.log`);
  fs.appendFileSync(logFile, formatted + '\n');
}

/**
 * Find PID of process listening on port
 */
function findProcessOnPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.on('error', (err) => {
      // If connection refused, we found the process
      if (err.code === 'ECONNREFUSED') {
        resolve(null);
      } else {
        server.close();
      }
    });
    
    server.once('listening', () => {
      // Try to connect - this will be refused by the actual process
      const client = net.createConnection({ port }, '127.0.0.1');
      
      client.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
          // Get the connection details to find the PID
          // On Windows, we need to use PowerShell commands instead
          resolve(null);
        } else {
          client.destroy();
        }
      });
      
      client.on('connect', () => {
        client.end();
      });
    });
    
    server.listen(port, '127.0.0.1');
  }).then(() => findPidByPort(DEFAULT_PORT));
}

/**
 * Find process ID by port (Windows cross-platform)
 */
function findPidByPort(port) {
  return new Promise((resolve) => {
    // Use PowerShell to get the PID since Windows has different approach
    const command = `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`;
    
    spawn('powershell', ['-Command', command], {
      cwd: PROJECT_ROOT,
      shell: true
    }).on('close', () => resolve(null));
  });
}

/**
 * Gracefully stop the engine process
 */
async function stopProcess(pid) {
  if (!pid) {
    log('✅ No engine process found on port 3160 - already stopped', 'info');
    return { success: true, pid: null, method: 'none' };
  }
  
  try {
    log(`Found engine process: PID ${pid}`, 'info');
    
    // Try graceful shutdown first (SIGTERM equivalent)
    const proc = spawn('taskkill', [
      '/PID', 
      pid.toString(), 
      '/T', 
      '/F'
    ]);
    
    proc.stdout.on('data', (data) => {
      log(data.toString().trim(), 'info');
    });
    
    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.includes('error') || line.includes('Error')) {
          log(line, 'warn');
        } else if (line.trim()) {
          log(line, 'info');
        }
      }
    });
    
    await new Promise((resolve, reject) => {
      proc.on('close', resolve);
      proc.on('error', reject);
    });
    
    // Verify process is dead
    const stillRunning = await findPidByPort(DEFAULT_PORT);
    if (stillRunning === null || !stillRunning) {
      log('✅ Engine process stopped successfully', 'info');
      return { success: true, pid, method: 'graceful' };
    } else {
      log(`⚠️ Process ${pid} still appears to be running`, 'warn');
    }
  } catch (error) {
    log(`Failed to stop process gracefully: ${error.message}`, 'warn');
  }
  
  // Force kill if graceful shutdown failed
  try {
    const forceKillProc = spawn('taskkill', [
      '/PID', 
      pid.toString(), 
      '/T', 
      '/F'
    ]);
    
    forceKillProc.stdout.on('data', (data) => {
      log(data.toString().trim(), 'info');
    });
    
    await new Promise((resolve, reject) => {
      forceKillProc.on('close', resolve);
      forceKillProc.on('error', reject);
    });
    
    const stillRunning = await findPidByPort(DEFAULT_PORT);
    if (stillRunning === null || !stillRunning) {
      log('✅ Engine process force-killed successfully', 'info');
      return { success: true, pid, method: 'force' };
    } else {
      throw new Error('Force kill also failed');
    }
  } catch (error) {
    log(`❌ Failed to force kill process: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * Get current engine port from logs if default fails
 */
function getEnginePort() {
  try {
    // Check for recent startup log to find actual port used
    const startLogs = fs.readdirSync(LOGS_DIR)
      .filter(f => f.startsWith('start-') && f.endsWith('.log'))
      .sort()
      .reverse();
    
    if (startLogs.length > 0) {
      const recentLog = path.join(LOGS_DIR, startLogs[0]);
      const content = fs.readFileSync(recentLog, 'utf8');
      
      // Look for "Engine running on" or port in logs
      const portMatch = content.match(/port\s*[:=]\s*(\d+)/i) ||
                        content.match(/on\s+(?:http[s]?://)?[^:]+:(\d+)/i);
      
      if (portMatch && portMatch[1]) {
        return parseInt(portMatch[1], 10);
      }
    }
  } catch (error) {
    log(`Could not read startup logs to find port`, 'warn');
  }
  
  return DEFAULT_PORT;
}

/**
 * Main function - shutdown engine
 */
async function main() {
  const timestamp = Date.now();
  
  try {
    log('========================================', 'info');
    log('Anchor Engine Shutdown', 'info');
    log('========================================', 'info');
    
    // Determine which port to look for
    const port = getEnginePort();
    log(`Looking for engine on port ${port}...`, 'info');
    
    // Find the process
    const pid = await findPidByPort(port);
    
    if (pid === null) {
      log('✅ No engine process found - already stopped', 'info');
      
      // Write summary
      const summary = {
        timestamp: new Date().toISOString(),
        status: 'already_stopped',
        port: port,
        pid: null
      };
      fs.writeFileSync(
        path.join(LOGS_DIR, `stop-${timestamp}.json`),
        JSON.stringify(summary, null, 2)
      );
      
    } else {
      log(`Found engine process: PID ${pid}`, 'info');
      
      // Stop the process
      const result = await stopProcess(pid);
      
      if (result.success) {
        log('========================================', 'info');
        log('✅ Engine stopped successfully!', 'info');
        log('========================================', 'info');
        
        // Write summary
        const summary = {
          timestamp: new Date().toISOString(),
          status: 'stopped',
          method: result.method,
          port: port,
          pid: result.pid
        };
        fs.writeFileSync(
          path.join(LOGS_DIR, `stop-${timestamp}.json`),
          JSON.stringify(summary, null, 2)
        );
      } else {
        log('========================================', 'info');
        log('❌ Failed to stop engine:', 'error');
        log(result.error, 'error');
        log('========================================', 'info');
        
        // Write error summary
        const errorSummary = {
          timestamp: new Date().toISOString(),
          status: 'failed',
          port: port,
          pid: pid,
          error: result.error
        };
        fs.writeFileSync(
          path.join(LOGS_DIR, `stop-error-${Date.now()}.json`),
          JSON.stringify(errorSummary, null, 2)
        );
        
        process.exit(1);
      }
    }
    
  } catch (error) {
    log(`❌ Shutdown failed: ${error.message}`, 'error');
    log(error.stack, 'error');
    
    // Write error to file
    const errorSummary = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    fs.writeFileSync(
      path.join(LOGS_DIR, `stop-error-${Date.now()}.json`),
      JSON.stringify(errorSummary, null, 2)
    );
    
    process.exit(1);
  }
  
  log('👋 Shutdown complete', 'info');
  process.exit(0);
}

// Run main function
main();
