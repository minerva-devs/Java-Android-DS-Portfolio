/**
 * Minimal Server Startup Test
 * 
 * This script tests just the server startup portion to isolate the issue
 */

import express from 'express';
import { db } from './dist/core/db.js';
import { config } from './dist/config/index.js';

async function testServerStartup() {
    console.log('🔍 Testing minimal server startup...');
    console.log(`🔧 Port: ${config.PORT}`);
    console.log(`🔧 Host: ${config.HOST}`);
    
    try {
        console.log('🔌 Initializing database...');
        await db.init();
        console.log('✅ Database initialized successfully');
        
        console.log('📡 Creating Express app...');
        const app = express();
        
        // Add a simple health check route
        app.get('/health', (req, res) => {
            res.status(200).json({ status: 'Sovereign', timestamp: new Date().toISOString() });
        });
        
        console.log(`📡 Attempting to listen on ${config.HOST}:${config.PORT}...`);
        
        // Try to start the server
        const server = app.listen(config.PORT, config.HOST, () => {
            console.log(`✅ Server running on ${config.HOST}:${config.PORT}`);
            console.log(`🏥 Health check available at http://${config.HOST}:${config.PORT}/health`);
            console.log(`🏥 Alternative health check: http://localhost:${config.PORT}/health`);
            
            // Close after a few seconds to avoid hanging
            setTimeout(() => {
                console.log('🔒 Closing server after test...');
                server.close(() => {
                    console.log('✅ Server closed');
                    process.exit(0);
                });
            }, 5000);
        });
        
        // Add error handling for the server
        server.on('error', (err) => {
            console.error('❌ Server error:', err);
            process.exit(1);
        });
        
    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
}

// Run the test
testServerStartup().catch(console.error);