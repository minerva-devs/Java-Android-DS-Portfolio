// Quick check - query github_repos table for sync errors
import { readFileSync } from 'fs';

const settings = JSON.parse(readFileSync('../.anchor/user_settings.json', 'utf8'));
const API_KEY = settings.server.api_key;
const BASE = 'http://localhost:3160';

async function checkGitHub() {
  const res = await fetch(`${BASE}/v1/github/repos`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  const repos = await res.json();
  console.log('Registered repos:', JSON.stringify(repos, null, 2));
}

checkGitHub().catch(e => console.error('Error:', e.message));
