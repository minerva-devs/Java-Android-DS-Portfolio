/**
 * Code Analyzer Service - Standard 019
 *
 * Runs a predefined toolchain of code analysis tools and normalizes
 * their output into a consistent format for ingestion.
 *
 * Tools:
 * - ESLint: Code style and potential errors (JS/TS)
 * - ts-prune: Unused exports (TS)
 * - dependency-cruiser: Module dependencies (JS/TS)
 * - jscpd: Duplicate code blocks (multi-language)
 *
 * Design principles:
 * - Graceful degradation: Skip failing tools, don't fail ingestion
 * - Timeout protection: 60s per tool
 * - Built-in configs: Use minimal defaults if repo lacks configs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface AnalysisResult {
  tool: string;
  file: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  rule?: string;
  metadata?: Record<string, any>;
}

export interface ToolOutput {
  tool: string;
  success: boolean;
  results: AnalysisResult[];
  rawOutput: any;
  durationMs: number;
  error?: string;
}

export interface AnalyzerConfig {
  timeoutMs: number;
  skipMissingTools: boolean;
  tools: ToolConfig[];
}

export interface ToolConfig {
  name: string;
  command: string;
  args: string[];
  fileExtensions: string[];
  requiresConfig: string[];
  defaultConfig?: string;
  parser: (output: string, repoPath: string) => AnalysisResult[];
}

// ============================================================================
// Built-in Default Configs
// ============================================================================

const DEFAULT_ESLINT_CONFIG = JSON.stringify({
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-undef': 'error',
    'no-console': 'off',
  },
  env: {
    node: true,
    es2022: true,
  },
});

const DEFAULT_TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'node',
    esModuleInterop: true,
    strict: false,
    skipLibCheck: true,
    noEmit: true,
  },
  include: ['**/*.ts', '**/*.tsx'],
  exclude: ['node_modules', 'dist', '.anchor-analysis'],
});

// ============================================================================
// Tool Parsers
// ============================================================================

/**
 * Parse ESLint JSON output
 */
function parseEslintOutput(output: string, repoPath: string): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  
  try {
    const eslintResults = JSON.parse(output);
    
    for (const fileResult of eslintResults) {
      const filePath = path.relative(repoPath, fileResult.filePath);
      
      for (const msg of fileResult.messages || []) {
        results.push({
          tool: 'eslint',
          file: filePath,
          line: msg.line,
          column: msg.column,
          severity: msg.severity === 2 ? 'error' : 'warning',
          message: msg.message,
          rule: msg.ruleId || undefined,
        });
      }
    }
  } catch (e) {
    // Output might not be JSON (e.g., no files found)
    console.warn('[Analyzer] ESLint output parse error:', e);
  }
  
  return results;
}

/**
 * Parse ts-prune output
 */
function parseTsPruneOutput(output: string, repoPath: string): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // ts-prune format: "path/to/file.ts:10 - unused export: SomeName"
    const match = line.match(/^(.+):(\d+)\s+-\s+(unused export:\s+.+)$/);
    if (match) {
      const filePath = path.relative(repoPath, match[1]);
      results.push({
        tool: 'ts-prune',
        file: filePath,
        line: parseInt(match[2], 10),
        severity: 'warning',
        message: match[3],
        rule: 'unused-export',
      });
    }
  }
  
  return results;
}

/**
 * Parse dependency-cruiser JSON output
 */
function parseDepCruiserOutput(output: string, repoPath: string): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  
  try {
    const depResults = JSON.parse(output);
    
    for (const module of depResults.modules || []) {
      const filePath = path.relative(repoPath, module.source);
      
      for (const dep of module.dependencies || []) {
        if (dep.valid === false || dep.couldNotResolve) {
          results.push({
            tool: 'dependency-cruiser',
            file: filePath,
            severity: dep.valid === false ? 'error' : 'warning',
            message: `Invalid dependency: ${dep.resolved || dep.module}`,
            rule: dep.rule ? dep.rule.name : 'invalid-dependency',
            metadata: {
              from: filePath,
              to: dep.module,
            },
          });
        }
      }
    }
  } catch (e) {
    console.warn('[Analyzer] dependency-cruiser output parse error:', e);
  }
  
  return results;
}

/**
 * Parse jscpd JSON output
 */
function parseJscpdOutput(output: string, repoPath: string): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  
  try {
    const jscpdResults = JSON.parse(output);
    
    for (const duplicate of jscpdResults.duplicates || []) {
      const firstFile = duplicate.firstFile ? path.relative(repoPath, duplicate.firstFile.name) : 'unknown';
      const secondFile = duplicate.secondFile ? path.relative(repoPath, duplicate.secondFile.name) : 'unknown';
      
      results.push({
        tool: 'jscpd',
        file: firstFile,
        line: duplicate.firstFile?.start || 0,
        severity: 'info',
        message: `Duplicate code (${duplicate.lines} lines) also found in ${secondFile}:${duplicate.secondFile?.start || 0}`,
        rule: 'duplicate-code',
        metadata: {
          lines: duplicate.lines,
          tokens: duplicate.tokens,
          files: [firstFile, secondFile],
        },
      });
    }
  } catch (e) {
    console.warn('[Analyzer] jscpd output parse error:', e);
  }
  
  return results;
}

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOL_CONFIGS: ToolConfig[] = [
  {
    name: 'eslint',
    command: 'npx',
    args: ['eslint', '--format', 'json', '--no-error-on-unmatched-pattern', '.'],
    fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
    requiresConfig: ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml'],
    defaultConfig: '.eslintrc.json',
    parser: parseEslintOutput,
  },
  {
    name: 'ts-prune',
    command: 'npx',
    args: ['ts-prune', '--json'],
    fileExtensions: ['.ts', '.tsx'],
    requiresConfig: ['tsconfig.json'],
    defaultConfig: 'tsconfig.json',
    parser: parseTsPruneOutput,
  },
  {
    name: 'dependency-cruiser',
    command: 'npx',
    args: ['depcruise', '--output-type', 'json', '--validate', '.'],
    fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
    requiresConfig: ['.dependency-cruiser.js', '.dependency-cruiser.json', '.dependency-cruiser.cjs'],
    parser: parseDepCruiserOutput,
  },
  {
    name: 'jscpd',
    command: 'npx',
    args: ['jscpd', '--reporters', 'json', '--min-lines', '5', '.'],
    fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.cpp', '.c'],
    requiresConfig: [],
    parser: parseJscpdOutput,
  },
];

// ============================================================================
// Main Analyzer Class
// ============================================================================

export class CodeAnalyzer {
  private config: AnalyzerConfig;
  
  constructor(config?: Partial<AnalyzerConfig>) {
    this.config = {
      timeoutMs: 60000, // 60 seconds per tool
      skipMissingTools: true,
      tools: TOOL_CONFIGS,
      ...config,
    };
  }
  
  /**
   * Detect languages in the repo based on file extensions
   */
  detectLanguages(repoPath: string): Set<string> {
    const languages = new Set<string>();
    const extensions = new Set<string>();
    
    const walkDir = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (ext) extensions.add(ext);
          }
        }
      } catch (e) {
        // Ignore permission errors
      }
    };
    
    walkDir(repoPath);
    
    // Map extensions to languages
    if (extensions.has('.ts') || extensions.has('.tsx')) languages.add('typescript');
    if (extensions.has('.js') || extensions.has('.jsx') || extensions.has('.mjs')) languages.add('javascript');
    if (extensions.has('.py')) languages.add('python');
    if (extensions.has('.go')) languages.add('go');
    if (extensions.has('.rs')) languages.add('rust');
    if (extensions.has('.java')) languages.add('java');
    if (extensions.has('.cpp') || extensions.has('.c') || extensions.has('.h')) languages.add('cpp');
    
    return languages;
  }
  
  /**
   * Check if a tool is applicable based on detected languages
   */
  isToolApplicable(tool: ToolConfig, languages: Set<string>): boolean {
    const toolLangs = new Set<string>();
    
    for (const ext of tool.fileExtensions) {
      if (['.ts', '.tsx'].includes(ext)) toolLangs.add('typescript');
      if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) toolLangs.add('javascript');
      if (ext === '.py') toolLangs.add('python');
      if (ext === '.go') toolLangs.add('go');
      if (ext === '.rs') toolLangs.add('rust');
      if (ext === '.java') toolLangs.add('java');
      if (['.cpp', '.c', '.h'].includes(ext)) toolLangs.add('cpp');
    }
    
    // Tool is applicable if any of its languages are detected
    for (const lang of toolLangs) {
      if (languages.has(lang)) return true;
    }
    
    return false;
  }
  
  /**
   * Write default config files if missing
   */
  ensureConfigs(repoPath: string): void {
    // Write default ESLint config if missing
    const eslintConfigPath = path.join(repoPath, '.eslintrc.json');
    if (!fs.existsSync(eslintConfigPath)) {
      const hasConfig = TOOL_CONFIGS[0].requiresConfig.some(cfg => 
        fs.existsSync(path.join(repoPath, cfg)),
      );
      if (!hasConfig) {
        fs.writeFileSync(eslintConfigPath, DEFAULT_ESLINT_CONFIG);
        console.log('[Analyzer] Created default .eslintrc.json');
      }
    }
    
    // Write default tsconfig if missing (needed for ts-prune)
    const tsconfigPath = path.join(repoPath, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
      fs.writeFileSync(tsconfigPath, DEFAULT_TSCONFIG);
      console.log('[Analyzer] Created default tsconfig.json');
    }
  }
  
  /**
   * Run a single tool with timeout
   */
  async runTool(tool: ToolConfig, repoPath: string): Promise<ToolOutput> {
    const startTime = Date.now();
    
    try {
      console.log(`[Analyzer] Running ${tool.name}...`);
      
      const { stdout, stderr } = await execAsync(
        `${tool.command} ${tool.args.join(' ')}`,
        {
          cwd: repoPath,
          timeout: this.config.timeoutMs,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        },
      );
      
      const output = stdout || stderr;
      const results = tool.parser(output, repoPath);
      
      console.log(`[Analyzer] ${tool.name} found ${results.length} issues`);
      
      return {
        tool: tool.name,
        success: true,
        results,
        rawOutput: output,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      // Tool might exit with non-zero code when issues found
      // Check if there's still valid output
      const output = error.stdout || error.stderr || '';
      
      if (output && !error.killed) {
        // Tool ran but found issues (non-zero exit)
        try {
          const results = tool.parser(output, repoPath);
          console.log(`[Analyzer] ${tool.name} found ${results.length} issues (exit code ${error.code})`);
          
          return {
            tool: tool.name,
            success: true,
            results,
            rawOutput: output,
            durationMs: Date.now() - startTime,
          };
        } catch (parseError) {
          // Can't parse output
          return {
            tool: tool.name,
            success: false,
            results: [],
            rawOutput: output,
            durationMs: Date.now() - startTime,
            error: `Parse error: ${parseError}`,
          };
        }
      }
      
      // Tool failed to run
      const errorMsg = error.killed 
        ? `Timeout after ${this.config.timeoutMs}ms`
        : error.message;
      
      console.warn(`[Analyzer] ${tool.name} failed: ${errorMsg}`);
      
      return {
        tool: tool.name,
        success: false,
        results: [],
        rawOutput: null,
        durationMs: Date.now() - startTime,
        error: errorMsg,
      };
    }
  }
  
  /**
   * Run all applicable tools and return results
   */
  async analyze(repoPath: string): Promise<ToolOutput[]> {
    const outputs: ToolOutput[] = [];
    
    // Detect languages
    const languages = this.detectLanguages(repoPath);
    console.log(`[Analyzer] Detected languages: ${Array.from(languages).join(', ') || 'none'}`);
    
    if (languages.size === 0) {
      console.warn('[Analyzer] No recognized languages detected, skipping analysis');
      return outputs;
    }
    
    // Ensure default configs exist
    this.ensureConfigs(repoPath);
    
    // Run each applicable tool
    for (const tool of this.config.tools) {
      if (!this.isToolApplicable(tool, languages)) {
        console.log(`[Analyzer] Skipping ${tool.name} (not applicable)`);
        continue;
      }
      
      const output = await this.runTool(tool, repoPath);
      outputs.push(output);
    }
    
    return outputs;
  }
  
  /**
   * Convert analysis results to JSONL format for ingestion
   */
  resultsToJsonl(outputs: ToolOutput[]): string {
    const lines: string[] = [];
    
    for (const output of outputs) {
      for (const result of output.results) {
        lines.push(JSON.stringify(result));
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Save analysis results to files
   */
  saveResults(outputs: ToolOutput[], analysisDir: string): { jsonlPath: string; rawPath: string } {
    // Ensure directory exists
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    
    // Save normalized JSONL
    const jsonlPath = path.join(analysisDir, 'analysis.jsonl');
    const jsonlContent = this.resultsToJsonl(outputs);
    fs.writeFileSync(jsonlPath, jsonlContent);
    
    // Save raw outputs for debugging
    const rawPath = path.join(analysisDir, 'analysis-raw.json');
    const rawContent = JSON.stringify(outputs, null, 2);
    fs.writeFileSync(rawPath, rawContent);
    
    console.log(`[Analyzer] Saved ${jsonlContent.split('\n').filter(Boolean).length} results to ${jsonlPath}`);
    
    return { jsonlPath, rawPath };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Run code analysis on a repo and return results
 */
export async function analyzeRepo(
  repoPath: string, 
  options?: { timeoutMs?: number },
): Promise<{ outputs: ToolOutput[]; jsonlPath: string; rawPath: string } | null> {
  const analyzer = new CodeAnalyzer(options);
  
  try {
    const outputs = await analyzer.analyze(repoPath);
    
    if (outputs.length === 0) {
      return null;
    }
    
    const analysisDir = path.join(repoPath, '.anchor-analysis');
    const { jsonlPath, rawPath } = analyzer.saveResults(outputs, analysisDir);
    
    return { outputs, jsonlPath, rawPath };
  } catch (error: any) {
    console.error('[Analyzer] Analysis failed:', error);
    return null;
  }
}

/**
 * Get summary statistics from analysis outputs
 */
export function getAnalysisSummary(outputs: ToolOutput[]): {
  totalIssues: number;
  errors: number;
  warnings: number;
  info: number;
  byTool: Record<string, number>;
} {
  let totalIssues = 0;
  let errors = 0;
  let warnings = 0;
  let info = 0;
  const byTool: Record<string, number> = {};
  
  for (const output of outputs) {
    byTool[output.tool] = output.results.length;
    
    for (const result of output.results) {
      totalIssues++;
      if (result.severity === 'error') errors++;
      else if (result.severity === 'warning') warnings++;
      else info++;
    }
  }
  
  return { totalIssues, errors, warnings, info, byTool };
}