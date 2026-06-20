// Artifact patterns to filter out (for clean mode)
export const DEFAULT_ARTIFACT_PATTERNS = [
    /```[a-zA-Z]*\s*[\s\S]*?```/g, // Code blocks with backticks
    /\/\/.*$/gm, // Single-line code comments
    /\{[^{}]*"original"[^}]*\}/g, // JSON-like artifacts (non-greedy)
    /^\s*d:\s*/gm, // Debug log timestamps (React style)
    /^\s*\[.*?\]/g, // Array logging like `[LRUCache]`
    /token_count\s*[:=]\s*\d+/g, // Token count debug strings
];
export const DEFAULT_MAX_CONTENT_LENGTH = 500; // characters for clean mode
// Utility to check if content contains artifacts
export function containsArtifacts(content, patterns) {
    if (!patterns)
        patterns = DEFAULT_ARTIFACT_PATTERNS;
    return patterns.some(pattern => pattern.test(content));
}
// Utility to strip artifacts from content
export function stripArtifacts(content, patterns) {
    if (!patterns)
        patterns = DEFAULT_ARTIFACT_PATTERNS;
    let cleaned = content;
    for (const pattern of patterns) {
        const matches = [...cleaned.matchAll(pattern)];
        if (matches.length > 0) {
            cleaned = cleaned.replace(pattern, '[REDACTED]');
        }
    }
    return cleaned;
}
// Validate content for clean mode
export function validateCleanContent(content, maxChars) {
    if (content.length > maxChars) {
        return { valid: false, reason: `exceeds_max_length`, truncated: true };
    }
    return { valid: true };
}
// Pre-processor for clean search results
export function preprocessCleanResult(result) {
    const molecule = { ...result };
    // Strip artifacts from content if present
    const artifactPatterns = result.removed_artifacts || [];
    molecule.clean_content = stripArtifacts(result.content, artifactPatterns);
    return molecule;
}
