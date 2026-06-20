const http = require('http');
const fs = require('fs');
const path = require('path');

const debugLogPath = path.join(process.env.HOME || 'C:/Users/rsbii', '.anchor', 'logs', 'http-debug.log');

const postData = JSON.stringify({
  seed: { query: "test" },
  radius: 2
});

const options = {
  hostname: 'localhost',
  port: 3160,
  path: '/v1/memory/distill',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const log = [
      '=== HTTP DEBUG ===',
      `Response Status: ${res.statusCode}`,
      `Response Body: ${data}`,
      `Sent Data: ${postData}`,
      `Content-Type Header: ${options.headers['Content-Type']}`,
      `Content-Length: ${options.headers['Content-Length']}`
    ].join('\n');
    
    try {
      fs.appendFileSync(debugLogPath, log + '\n\n');
      console.log('Debug log written to', debugLogPath);
    } catch (err) {
      console.error('Failed to write debug log:', err);
    }
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
});

req.write(postData);
req.end();
