/**
 * ChatWorker — Local inference stub.
 *
 * node-llama-cpp has been removed from this project (user intent: pare to working core).
 * Local LLM inference is NOT available. Configure LLM_PROVIDER=remote in user_settings.json
 * to use a remote OpenAI-compatible endpoint instead.
 *
 * To restore local inference:
 *   1. Re-add node-llama-cpp to engine/package.json
 *   2. Restore the original ChatWorker implementation from git history
 */
import { parentPort } from 'worker_threads';

// Worker stub — signals ready immediately, returns errors for all requests
async function init() {
    console.warn('[ChatWorker] Local inference is disabled. node-llama-cpp has been removed.');
    parentPort?.postMessage({ type: 'ready' });
}

parentPort?.on('message', message => {
    const err = 'Local inference not available. node-llama-cpp removed. Use LLM_PROVIDER=remote.';
    if (message.type === 'dispose') {
        parentPort?.postMessage({ type: 'disposed' });
    } else {
        parentPort?.postMessage({ type: 'error', error: err });
    }
});

init();
