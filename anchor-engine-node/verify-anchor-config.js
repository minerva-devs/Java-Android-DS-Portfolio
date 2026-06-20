import fs from 'fs';
try {
    const data = JSON.parse(fs.readFileSync('../anchor\\user_settings.json', 'utf8'));
    console.log('✅ Valid JSON with', Object.keys(data).length, 'keys');
} catch (e) {
    console.error('❌ Invalid JSON:', e.message);
}
