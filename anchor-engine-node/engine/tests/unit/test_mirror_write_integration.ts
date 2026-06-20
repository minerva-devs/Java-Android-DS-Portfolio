import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

describe('Mirror Write Integration', () => {
    const TEST_FILE_PATH = path.join(process.cwd(), 'inbox/test-mirror-write.md');
    const MIRRORED_BRAIN_DIR = process.env.MIRRORED_BRAIN_DIR || 'mirrored_brain';
    
    let serverUrl: string;

    beforeAll(async () => {
        // Wait for server to be ready
        console.log('Waiting for server...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
            const response = await axios.get('http://localhost:3000/v1/health', { timeout: 5000 });
            if (response.status === 200) {
                serverUrl = 'http://localhost:3000';
                console.log('Server is ready at:', serverUrl);
            } else {
                throw new Error(`Unexpected health check status: ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to connect to server:', error.message);
            throw new Error('Server not available. Please start the anchor-engine server first.');
        }
    });

    afterAll(() => {
        // Cleanup test file if it exists
        if (fs.existsSync(TEST_FILE_PATH)) {
            fs.unlinkSync(TEST_FILE_PATH);
            console.log(`Cleaned up test file: ${TEST_FILE_PATH}`);
        }
    });

    it('should write ingested content to mirrored_brain/@inbox/', async () => {
        // Create test content
        const testContent = `# Mirror Write Test Note

This is a test note to verify that:
1. Ingested files are written to mirrored_brain/
2. The path structure is preserved (inbox/test-note.md -> @inbox/test-note.md)
3. Distillation can read the mirrored content and produce blocks

## Expected Behavior
- After ingestion, file should appear at: \`mirrored_brain/@inbox/test-mirror-write.md\`
- Content should be identical to original
- Distillation should discover this file and create blocks from it
`;

        // Create inbox directory if needed
        const inboxDir = path.join(process.cwd(), 'inbox');
        if (!fs.existsSync(inboxDir)) {
            fs.mkdirSync(inboxDir, { recursive: true });
        }

        // Write test file
        fs.writeFileSync(TEST_FILE_PATH, testContent);
        console.log(`Created test file: ${TEST_FILE_PATH}`);

        try {
            // Ingest the file via API
            const response = await axios.post(
                `${serverUrl}/v1/ingest`,
                {
                    content: testContent,
                    source: 'inbox/test-mirror-write.md',
                    type: 'note',
                    bucket: 'test'
                },
                { timeout: 30000 }
            );

            expect(response.status).toBe(200);
            const result = response.data;
            console.log('Ingest response:', JSON.stringify(result, null, 2));
            
            expect(result.status).toBe('success');
            expect(result.message).toContain('Ingested');
            expect(result.atoms_count).toBeGreaterThan(0);

        } catch (error: any) {
            if (error.response?.status === 400) {
                console.error('API validation error:', error.response.data);
            }
            throw error;
        }

        // Wait for mirror write to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify mirrored_brain directory exists
        const mirrorDir = path.join(process.cwd(), MIRRORED_BRAIN_DIR, '@inbox');
        
        if (!fs.existsSync(mirrorDir)) {
            throw new Error(`Mirrored brain directory not found: ${mirrorDir}`);
        }
        console.log('✓ Mirrored brain directory exists:', mirrorDir);

        // Verify test file was written to mirror
        const mirroredFilePath = path.join(mirrorDir, 'test-mirror-write.md');
        
        if (!fs.existsSync(mirroredFilePath)) {
            throw new Error(`Mirrored file not found: ${mirroredFilePath}`);
        }
        console.log('✓ Mirrored file exists:', mirroredFilePath);

        // Verify content matches
        const originalContent = fs.readFileSync(TEST_FILE_PATH, 'utf-8');
        const mirroredContent = fs.readFileSync(mirroredFilePath, 'utf-8');
        
        expect(mirroredContent).toBe(originalContent);
        console.log('✓ Content matches between original and mirror');

        // Verify file metadata
        const stats = fs.statSync(mirroredFilePath);
        expect(stats.size).toBeGreaterThan(0);
        console.log(`✓ File size: ${stats.size} bytes`);

        console.log('\n✅ All mirror write tests passed!');
    });
});
