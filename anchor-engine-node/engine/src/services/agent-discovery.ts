/**
 * Agent Discovery Service
 *
 * Auto-detects AI agent chat directories for memory integration.
 * Supports: Qwen Code, Claude Desktop, Cursor, Continue.dev
 */

import { stat, readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Known AI agents and their chat directory patterns
 */
export const KNOWN_AGENTS = {
  qwen: {
    id: 'qwen',
    name: 'Qwen Code',
    description: 'Qwen Code AI assistant',
    paths: [
      // Termux/Android
      join(homedir(), '.qwen', 'projects', '-data-data-com-termux-files-home', 'chats'),
      // Standard Linux/macOS
      join(homedir(), '.qwen', 'projects', '-', 'chats'),
      // Alternative project pattern
      join(homedir(), '.qwen', 'projects'),
    ],
    filePattern: /\.jsonl$/,
  },
  claude: {
    id: 'claude',
    name: 'Claude Desktop',
    description: 'Anthropic Claude Desktop app',
    paths: [
      // Linux
      join(homedir(), '.config', 'Claude', 'chats'),
      // macOS
      join(homedir(), 'Library', 'Application Support', 'Claude', 'chats'),
      // Windows
      join(homedir(), 'AppData', 'Roaming', 'Claude', 'chats'),
    ],
    filePattern: /\.jsonl$/,
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    description: 'Cursor AI code editor',
    paths: [
      // Linux/macOS
      join(homedir(), '.cursor', 'chats'),
      // Windows
      join(homedir(), 'AppData', 'Roaming', 'Cursor', 'chats'),
    ],
    filePattern: /\.jsonl$/,
  },
  continue: {
    id: 'continue',
    name: 'Continue.dev',
    description: 'Continue.dev AI assistant',
    paths: [
      // Linux/macOS
      join(homedir(), '.continue', 'chats'),
      // Windows
      join(homedir(), 'AppData', 'Roaming', 'Continue', 'chats'),
    ],
    filePattern: /\.jsonl$/,
  },
};

export interface DiscoveredAgent {
  id: string;
  name: string;
  description: string;
  path: string;
  sessionCount: number;
  isWatched: boolean;
  lastModified?: Date;
}

/**
 * Check if a directory exists and contains chat files
 */
async function checkAgentPath(
  agentPath: string,
  filePattern: RegExp,
): Promise<{ exists: boolean; sessionCount: number; lastModified?: Date }> {
  try {
    const s = await stat(agentPath);
    if (!s.isDirectory()) {
      return { exists: false, sessionCount: 0 };
    }

    const files = await readdir(agentPath);
    const chatFiles = files.filter(f => filePattern.test(f));

    // Get last modified time
    let lastModified: Date | undefined;
    if (chatFiles.length > 0) {
      try {
        const fileStats = await Promise.all(
          chatFiles.slice(0, 10).map(f => stat(join(agentPath, f))),
        );
        const maxTime = Math.max(...fileStats.map(fs => fs.mtimeMs));
        lastModified = new Date(maxTime);
      } catch {
        // Ignore stat errors
      }
    }

    return {
      exists: true,
      sessionCount: chatFiles.length,
      lastModified,
    };
  } catch {
    return { exists: false, sessionCount: 0 };
  }
}

/**
 * Discover all installed AI agents
 *
 * @param watchedPaths - Current watched paths to check if agent is already watched
 * @returns Array of discovered agents
 */
export async function discoverAgents(watchedPaths: string[] = []): Promise<DiscoveredAgent[]> {
  const discovered: DiscoveredAgent[] = [];

  for (const [id, agent] of Object.entries(KNOWN_AGENTS)) {
    for (const agentPath of agent.paths) {
      const result = await checkAgentPath(agentPath, agent.filePattern);

      if (result.exists && result.sessionCount > 0) {
        // Check if this path is already being watched
        const isWatched = watchedPaths.some(p =>
          p.includes(agentPath) || agentPath.includes(p),
        );

        discovered.push({
          id: agent.id,
          name: agent.name,
          description: agent.description,
          path: agentPath,
          sessionCount: result.sessionCount,
          isWatched,
          lastModified: result.lastModified,
        });

        // Found this agent, move to next
        break;
      }
    }
  }

  // Sort by session count (most sessions first)
  discovered.sort((a, b) => b.sessionCount - a.sessionCount);

  return discovered;
}

/**
 * Get a specific agent's chat directory
 *
 * @param agentId - Agent identifier (qwen, claude, cursor, continue)
 * @returns Path to agent's chat directory or null if not found
 */
export async function getAgentPath(agentId: string): Promise<string | null> {
  const agent = KNOWN_AGENTS[agentId.toLowerCase() as keyof typeof KNOWN_AGENTS];
  if (!agent) {
    return null;
  }

  for (const agentPath of agent.paths) {
    const result = await checkAgentPath(agentPath, agent.filePattern);
    if (result.exists) {
      return agentPath;
    }
  }

  return null;
}

/**
 * Get all possible paths for an agent (for error messages)
 */
export function getAgentPossiblePaths(agentId: string): string[] {
  const agent = KNOWN_AGENTS[agentId.toLowerCase() as keyof typeof KNOWN_AGENTS];
  return agent?.paths || [];
}