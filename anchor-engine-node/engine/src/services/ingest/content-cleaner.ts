/**
 * Content Cleaning Service - "Data Refinery"
 * 
 * Normalizes and cleans content during ingestion:
 * - HTML entity decoding
 * - Unicode normalization
 * - Control character removal
 * - Whitespace normalization
 * - Boilerplate removal (web scrapes)
 * - Line ending standardization
 */

export interface CleanOptions {
    /** Remove HTML tags */
    stripHtml?: boolean;
    /** Decode HTML entities */
    decodeHtml?: boolean;
    /** Normalize Unicode (NFC) */
    normalizeUnicode?: boolean;
    /** Remove control characters */
    removeControlChars?: boolean;
    /** Normalize whitespace */
    normalizeWhitespace?: boolean;
    /** Remove boilerplate (nav, footer, etc.) */
    removeBoilerplate?: boolean;
    /** Standardize line endings to \n */
    normalizeLineEndings?: boolean;
    /** Remove excessive blank lines */
    collapseBlankLines?: boolean;
}

const DEFAULT_OPTIONS: CleanOptions = {
    stripHtml: true,
    decodeHtml: true,
    normalizeUnicode: true,
    removeControlChars: true,
    normalizeWhitespace: true,
    removeBoilerplate: false,
    normalizeLineEndings: true,
    collapseBlankLines: true,
};

/**
 * Clean content with configurable options
 */
export function cleanContent(content: string, options: CleanOptions = {}): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let cleaned = content;

    // 1. Remove boilerplate (web scrapes)
    if (opts.removeBoilerplate) {
        cleaned = removeBoilerplate(cleaned);
    }

    // 2. Strip HTML tags
    if (opts.stripHtml) {
        cleaned = stripHtmlTags(cleaned);
    }

    // 3. Decode HTML entities
    if (opts.decodeHtml) {
        cleaned = decodeHtmlEntities(cleaned);
    }

    // 4. Normalize Unicode
    if (opts.normalizeUnicode) {
        cleaned = cleaned.normalize('NFC');
    }

    // 5. Remove control characters (except \n, \t, \r)
    if (opts.removeControlChars) {
        cleaned = removeControlCharacters(cleaned);
    }

    // 6. Normalize line endings
    if (opts.normalizeLineEndings) {
        cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    // 7. Collapse excessive blank lines
    if (opts.collapseBlankLines) {
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    }

    // 8. Normalize whitespace
    if (opts.normalizeWhitespace) {
        cleaned = normalizeWhitespace(cleaned);
    }

    // 9. Trim
    cleaned = cleaned.trim();

    return cleaned;
}

/**
 * Strip HTML tags from content
 */
function stripHtmlTags(html: string): string {
    // Remove script and style content first
    let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Remove all other tags
    cleaned = cleaned.replace(/<[^>]*>/g, ' ');
    
    return cleaned;
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
        '&nbsp;': ' ',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&mdash;': '—',
        '&ndash;': '–',
        '&hellip;': '…',
        '&lsquo;': "'",
        '&rsquo;': "'",
        '&ldquo;': '"',
        '&rdquo;': '"',
        '&bull;': '•',
        '&copy;': '©',
        '&reg;': '®',
        '&trade;': '™',
    };

    let decoded = text;
    for (const [entity, char] of Object.entries(entities)) {
        decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }

    // Decode numeric entities
    decoded = decoded.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
    decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    return decoded;
}

/**
 * Remove control characters (keep \n, \t, \r)
 */
function removeControlCharacters(text: string): string {
    // Remove control chars except tab, newline, carriage return
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Normalize whitespace
 */
function normalizeWhitespace(text: string): string {
    // Replace multiple spaces with single space (preserve newlines)
    return text.replace(/[^\S\n]+/g, ' ');
}

/**
 * Remove common boilerplate from web scrapes
 */
function removeBoilerplate(text: string): string {
    let cleaned = text;

    // Remove common boilerplate patterns
    const boilerplatePatterns = [
        // Navigation
        /<nav\b[^>]*>[\s\S]*?<\/nav>/gi,
        // Footer
        /<footer\b[^>]*>[\s\S]*?<\/footer>/gi,
        // Sidebar
        /<aside\b[^>]*>[\s\S]*?<\/aside>/gi,
        // Cookie notices
        /<div[^>]*class="[^"]*cookie[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
        // Ad containers
        /<div[^>]*class="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
        // Social share buttons
        /<div[^>]*class="[^"]*share[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
        // Comments sections
        /<div[^>]*id="[^"]*comments[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
        // Related posts
        /<div[^>]*class="[^"]*related[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    ];

    for (const pattern of boilerplatePatterns) {
        cleaned = cleaned.replace(pattern, '');
    }

    return cleaned;
}

/**
 * Get cleaning statistics
 */
export function getCleaningStats(original: string, cleaned: string): {
    originalLength: number;
    cleanedLength: number;
    reductionPercent: number;
    charsRemoved: number;
} {
    const originalLength = original.length;
    const cleanedLength = cleaned.length;
    const charsRemoved = originalLength - cleanedLength;
    const reductionPercent = originalLength > 0 ? (charsRemoved / originalLength * 100) : 0;

    return {
        originalLength,
        cleanedLength,
        reductionPercent: Math.round(reductionPercent * 100) / 100,
        charsRemoved,
    };
}
