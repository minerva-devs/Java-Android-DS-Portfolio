/**
 * Live-Fire Server Setup Script
 * 
 * This script starts the Anchor Engine server for integration testing.
 * It handles:
 * - Dependency installation
 * - Repository setup (if needed)
 * - Server launch with appropriate flags
 * - Health check verification
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
  projectRoot: process.cwd(),
  engineDir: path.join(process.cwd(), 'engine'),
  distDir: path.join(process.cwd(), 'engine/dist'),
  dataDir: process.env.ANCHOR_DATA_DIR || path.join(process.cwd(), '.anchor'),
  port: process.env.PORT || 3160,
  logFile: path.join(process.cwd(), 'engine/tests/live-fire/server.log'),
};

// Ensure test directories exist
const ensureDirs = () => {
  const dirs = [
    CONFIG.engineDir,
    CONFIG.distDir,
    path.join(CONFIG.engineDir, 'tests', 'live-fire')
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
};

// Check if build is needed
const checkBuild = () => {
  const packageJsonPath = path.join(CONFIG.engineDir, 'package.json');
  
  // Read the main entry point to see if dist exists
  const indexPath = path.join(CONFIG.engineDir, 'src/index.ts');
  if (!fs.existsSync(indexPath)) {
    console.log('[Setup] Source files not found. Building from TypeScript...');
    runBuild();
    return true;
  }
  
  // Check if dist folder exists and has index.js
  if (fs.existsSync(CONFIG.distDir) && fs.existsSync(path.join(CONFIG.distDir, 'index.js'))) {
    console.log('[Setup] Using existing build in:', CONFIG.distDir);
    return false;
  }
  
  console.log('[Setup] Building project...');
  runBuild();
  return true;
};

const runBuild = () => {
  const { execSync } = require('child_process');
  
  try {
    // Change to project root for pnpm commands
    process.chdir(path.join(CONFIG.engineDir, '..'));
    
    // Run build
    execSync('pnpm run build', { 
      stdio: 'inherit',
      env: { ...process.env, CI: 'true' }
    });
    
    console.log('[Setup] Build completed successfully');
  } catch (error) {
    console.error('[Setup] Build failed:', error.message);
    process.exit(1);
  }
};

const startServer = () => {
  return new Promise((resolve, reject) => {
    const args = [
      '--data-dir', CONFIG.dataDir,
      '--port', String(CONFIG.port),
      '--no-external-ingestion' // Disable external ingestion for tests
    ];
    
    const env = { ...process.env };
    
    // Start the server
    const child = spawn('node', [path.join(CONFIG.engineDir, 'dist/index.js'), ...args], {
      cwd: CONFIG.projectRoot,
      env,
      stdio: ['pipe', 'pipe', 'inherit']
    });
    
    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    
    // Collect server logs to file
    const logStream = fs.createWriteStream(CONFIG.logFile, { flags: 'w' });
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);
    
    child.on('exit', (code) => {
      if (code === 0 || code === null) {
        resolve(child);
      } else {
        reject(new Error(`Server exited with code ${code}`));
      }
    });
    
    // Wait a bit then check health
    setTimeout(() => {
      healthCheck((healthy) => {
        if (healthy) {
          console.log('[Setup] Server health check passed');
          resolve(child);
        } else {
          reject(new Error('Server started but health check failed'));
        }
      });
    }, 3000);
  });
};

const healthCheck = (callback) => {
  const http = require('http');
  
  const options = {
    hostname: 'localhost',
    port: CONFIG.port,
    path: '/health',
    method: 'GET'
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('[Health] Response:', data);
      // Health endpoint returns JSON with status
      const healthy = data.includes('ok') || res.statusCode === 200;
      callback(healthy);
    });
  });
  
  req.on('error', (e) => {
    console.error('[Health] Check failed:', e.message);
    callback(false);
  });
  
  req.end();
};

// Main execution
const main = async () => {
  try {
    ensureDirs();
    
    if (!fs.existsSync(CONFIG.distDir)) {
      // First build required
      runBuild();
    }
    
    console.log('[Setup] Starting server...');
    const child = await startServer();
    console.log('[Setup] Server running, PID:', child.pid);
    process.exit(0);
  } catch (error) {
    console.error('[Setup] Fatal error:', error);
    process.exit(1);
  }
};

main();