/**
 * Code AST Parser – semantic atomization of TypeScript / JavaScript files.
 *
 * Parses source code with web-tree-sitter, walks the syntax tree and extracts
 * structural atoms (functions, classes, methods) together with
 * metadata such as function name, class context, imports, etc.
 */

import { Parser, Language } from 'web-tree-sitter';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Public types ────────────────────────────────────────────────────────

export interface CodeBlock {
  type: 'function' | 'class' | 'method' | 'arrow_function' | 'block';
  name: string | null;
  classContext: string | null;
  startLine: number;
  endLine: number;
  startByte: number;
  endByte: number;
  text: string;
  imports: string[];
}

export interface CodeStructure {
  blocks: CodeBlock[];
}

// ── WASM initialization state ───────────────────────────────────────────

let _webAssemblyInitialized = false;

/** Resolve the directory containing web-tree-sitter's .wasm files absolutely */
function getWasmDir(): string {
  // Get the absolute path from import.meta.url (ES modules) or __dirname (CommonJS)
  let currentDir: string;
  if (import.meta.url) {
    currentDir = new URL(import.meta.url).pathname;
  } else {
    currentDir = __dirname || process.cwd();
  }

  // Walk up from the current directory to find node_modules/web-tree-sitter
  while (currentDir !== dirname(currentDir)) {
    const candidate = join(dirname(currentDir), 'node_modules', 'web-tree-sitter');
    try {
      require('fs').accessSync(join(candidate, 'web-tree-sitter.wasm'));
      return candidate;
    } catch {
      currentDir = dirname(currentDir);
    }
  }

  // Fallback: check project root node_modules
  const cwd = process.cwd();
  const rootWasm = join(cwd, 'node_modules', 'web-tree-sitter');
  try {
    require('fs').accessSync(join(rootWasm, 'web-tree-sitter.wasm'));
    return rootWasm;
  } catch {
    throw new Error('Could not locate web-tree-sitter WASM files');
  }
}

async function initWebAssembly() {
  if (_webAssemblyInitialized) return;

  const wasmPath = getWasmDir();

  // Initialize parser - this loads the main web-tree-sitter.wasm
  await Parser.init({
    locateFile: (filename: string) => {
      // The filename from web-tree-sitter includes the .wasm extension
      // e.g., "tree-sitter-typescript.wasm" or "web-tree-sitter.wasm"
      const fullPath = join(wasmPath, filename);

      // Verify the file exists before returning it
      import('fs').then(fs => {
        if (!fs.existsSync(fullPath)) {
          throw new Error(`WASM file not found: ${fullPath}`);
        }
      }).catch(() => {
        // fs might not be available in browser environment
      });

      return fullPath;
    },
  });

  _webAssemblyInitialized = true;
}

// ── Language registry ───────────────────────────────────────────────────

const LANGUAGES_CACHE: Record<string, Language> = {};

/** Map our language key to the tree-sitter WASM filename */
function getWasmFileName(langKey: string): string {
  switch (langKey) {
    case 'typescript': return 'tree-sitter-typescript.wasm';
    case 'tsx': return 'tree-sitter-tsx.wasm';
    case 'javascript': return 'tree-sitter-javascript.wasm';
    default: throw new Error(`Unsupported language key: ${langKey}`);
  }
}

async function getLanguage(key: string): Promise<Language> {
  if (LANGUAGES_CACHE[key]) return LANGUAGES_CACHE[key];

  await initWebAssembly();

  const wasmFile = getWasmFileName(key);
  
  // Try multiple locations for the WASM file
  const possiblePaths = [
    join(getWasmDir(), wasmFile),
    join(process.cwd(), 'node_modules', wasmFile.replace(/\.wasm$/, '')),
    join(process.cwd(), 'node_modules', 'web-tree-sitter', wasmFile),
  ];

  let fullPath: string | undefined;
  for (const path of possiblePaths) {
    try {
      require('fs').accessSync(path);
      fullPath = path;
      break;
    } catch {
      // Try next path
    }
  }

  if (!fullPath || !require('fs').existsSync(fullPath)) {
    throw new Error(`WASM file not found: ${wasmFile}`);
  }

  const language = await Language.load(fullPath);
  LANGUAGES_CACHE[key] = language;
  return language;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function extractNodeName(node: import('web-tree-sitter').Node): string | null {
  // field name 'name' is the canonical way in tree-sitter v0.25
  const nameChild = node.childForFieldName('name');
  if (nameChild && nameChild.text.trim()) return nameChild.text.trim();

  // fallback: first named child that isn't a keyword/comment
  for (const child of node.namedChildren) {
    if (!child.text.startsWith('#') && child.type !== 'statement_block') {
      const inner = extractNameFromExpression(child);
      if (inner) return inner;
    }
  }
  return null;
}

function extractNameFromExpression(node: import('web-tree-sitter').Node): string | null {
  switch (node.type) {
    case 'identifier':
      return node.text;
    case 'member_expression': {
      const obj = node.childForFieldName('object');
      const prop = node.childForFieldName('property');
      if (obj && prop) return `${obj.text}.${prop.text}`;
      break;
    }
  }
  const id = node.namedChildren.find(c => c.type === 'identifier');
  return id ? id.text : null;
}

function gatherImports(rootNode: import('web-tree-sitter').Node): string[] {
  const imports: string[] = [];
  
  function walk(node: import('web-tree-sitter').Node) {
    if (node.type === 'import_statement' || node.type === 'import_clause') {
      const mod = node.childForFieldName('source');
      if (mod) {
        const spec = mod.text.replace(/^['"`]|['"`]$/g, '');
        if (spec && !imports.includes(spec)) imports.push(spec);
      }
    }
    for (const child of node.namedChildren) walk(child);
  }
  
  walk(rootNode);
  return imports;
}

function collectBlocks(code: string, rootNode: import('web-tree-sitter').Node): CodeBlock[] {
  const blocks: CodeBlock[] = [];

  function visit(node: import('web-tree-sitter').Node) {
    let blockType: CodeBlock['type'] | null = null;
    let name: string | null = null;
    let classContext: string | null = null;

    if (node.type === 'function_declaration') {
      blockType = 'function';
      const funcNameNode = node.childForFieldName('name');
      name = funcNameNode ? funcNameNode.text.trim() : null;
    } else if (node.type === 'class_declaration' || node.type === 'class_expression') {
      blockType = 'class';
      name = extractNodeName(node);
    } else if (node.type === 'method_definition' || node.type === 'field_definition') {
      blockType = 'method';
      const fieldName = node.childForFieldName('name');
      if (fieldName) name = fieldName.text.trim();
      else {
        for (const child of node.namedChildren) {
          if (child.type !== 'statement_block' && !child.text.startsWith('#')) {
            name = child.text;
            break;
          }
        }
      }

      // Walk ancestors to find enclosing class/interface
      let ancestor = node.parent;
      while (ancestor) {
        if (ancestor.type === 'class_declaration' || ancestor.type === 'class_expression') {
          const clsName = extractNodeName(ancestor);
          if (clsName) classContext = clsName;
          break;
        }
        if (ancestor.type === 'interface_declaration') {
          const ifaceName = ancestor.childForFieldName('name');
          if (ifaceName) classContext = ifaceName.text.trim();
          break;
        }
        ancestor = ancestor.parent;
      }
    } else if (node.type === 'arrow_function' || node.type === 'function_expression') {
      blockType = 'arrow_function';
      name = extractNodeName(node);
    }

    if (blockType && name) {
      blocks.push({
        type: blockType,
        name,
        classContext,
        startLine: node.startPosition.row + 1, // 1-indexed for human readers
        endLine: node.endPosition.row + 1,
        startByte: node.startIndex,
        endByte: node.endIndex,
        text: code.substring(node.startIndex, node.endIndex),
        imports: [], // filled later
      });

      for (const child of node.namedChildren) visit(child);
    } else {
      for (const child of node.namedChildren) visit(child);
    }
  }

  for (const child of rootNode.namedChildren) visit(child);

  blocks.sort((a, b) => a.startByte - b.startByte);
  return blocks;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Parse source code and extract semantic atoms.
 */
export async function parseCodeStructure(
  code: string,
  language: 'typescript' | 'tsx' | 'javascript',
): Promise<CodeStructure | null> {
  try {
    let langKey: 'typescript' | 'javascript' = language === 'tsx' ? 'typescript' : language;
    const lang = await getLanguage(langKey);
    const parser = new Parser();
    parser.setLanguage(lang);

    const tree = parser.parse(code);

    if (!tree || !tree.rootNode) return null;

    // Check for parse errors using the ParseState approach
    const rootNode = tree.rootNode;
    if (rootNode.isError) {
      return null;
    }

    const blocks = collectBlocks(code, rootNode);
    const imports = gatherImports(rootNode);

    for (const block of blocks) {
      block.imports = [...imports];
    }

    return { blocks };
  } catch (err: any) {
    console.warn('[astParser] Parse failed:', err.message);
    return null;
  }
}

// ── Language detection from file extension ──────────────────────────────

export const CODE_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx'] as const;

/** Map a file extension to a tree-sitter language key */
export function extToLanguage(ext: string): 'typescript' | 'tsx' | 'javascript' | null {
  switch (ext) {
    case 'ts': return 'typescript';
    case 'tsx': return 'tsx';
    case 'js': return 'javascript';
    case 'jsx': return 'javascript';
    default: return null;
  }
}
