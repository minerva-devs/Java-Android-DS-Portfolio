/**
 * Engine Startup Diagnostic
 * 
 * This script tests if the engine can start properly without the Electron wrapper
 */

import express from 'express';
import { db } from './dist/core/db.js';
import { config } from './dist/config/index.js';

async function diagnoseEngine() {
    console.log('🔍 Starting Engine Diagnostic...');
    console.log(`🔧 Port: ${config.PORT}`);
    console.log(`🔧 Host: ${config.HOST}`);
    
    try {
        console.log('🔌 Initializing database...');
        await db.init();
        console.log('✅ Database initialized successfully');
        
        console.log('📡 Creating Express app...');
        const app: express.Application = express();
        
        // Add a simple health check route
        app.get('/health', (_req, res) => {
            res.status(200).json({ status: 'Sovereign', timestamp: new Date().toISOString() });
        });
        
        console.log(`📡 Attempting to listen on ${config.HOST}:${config.PORT}...`);
        
        // Try to start the server
        const server = app.listen(config.PORT, config.HOST, () => {
            console.log(`✅ Server running on ${config.HOST}:${config.PORT}`);
            console.log(`🏥 Health check available at http://${config.HOST}:${config.PORT}/health`);
        });
        
        // Wait a bit then test the connection
        setTimeout(async () => {
            try {
                const response = await fetch(`http://${config.HOST}:${config.PORT}/health`);
                console.log(`🏥 Health check response: ${response.status} ${response.statusText}`);
                const data = await response.json();
                console.log('🏥 Health check data:', data);
                
                // Close the server after testing
                server.close(() => {
                    console.log('🔒 Server closed');
                });
            } catch (error) {
                console.error('🏥 Health check failed:', error);
                
                // Close the server
                server.close(() => {
                    console.log('🔒 Server closed after error');
                });
            }
        }, 2000); // Wait 2 seconds before testing
        
    } catch (error) {
        console.error('❌ Engine startup failed:', error);
    }
}

// Run the diagnostic
diagnoseEngine().catch(console.error);