/**
 * Project configuration loader.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { CONTENT_CONFIG, PATHS } from '../constants.js';
import type { ProjectConfig } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * Default project configuration values.
 */
const DEFAULT_CONFIG: Partial<ProjectConfig> = {
  enabled: true,
  triggers: {
    branches: ['main'],
    events: ['pr_merged', 'push'],
    filePatterns: {
      include: ['**/*'],
      exclude: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*'],
    },
  },
  content: {
    types: ['mixed'],
    tone: 'professional-casual',
  },
  formatting: {
    hashtags: {
      always: ['#DevLife', '#Coding'],
      project: [],
    },
    emojis: true,
  },
  thread: {
    minCommitsForThread: 3,
    maxTweets: 10,
    alwaysGenerateImage: true,
    singleTweetImageProbability: CONTENT_CONFIG.SINGLE_TWEET_IMAGE_PROBABILITY,
  },
  debounce: {
    pushDebounceMinutes: CONTENT_CONFIG.PUSH_DEBOUNCE_MINUTES,
    prImmediate: CONTENT_CONFIG.PR_IMMEDIATE,
  },
  platforms: {
    x: true,
  },
};

/**
 * Parse YAML-like config (simple key-value)
 * For production, use a proper YAML parser
 */
function parseYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  let currentKey = '';
  let currentIndent = 0;
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [
    { obj: result, indent: -1 },
  ];

  for (const rawLine of lines) {
    const line = rawLine;
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Handle list items
    if (trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).trim();
      const parent = stack[stack.length - 1].obj;
      if (!Array.isArray(parent[currentKey])) {
        parent[currentKey] = [];
      }
      (parent[currentKey] as unknown[]).push(value.replace(/^["']|["']$/g, ''));
      continue;
    }

    // Handle key-value pairs
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();

    // Pop stack if we're moving back up
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1].obj;

    if (value === '' || value === '|') {
      // Nested object
      current[key] = {};
      stack.push({ obj: current[key] as Record<string, unknown>, indent });
      currentKey = key;
      currentIndent = indent;
    } else {
      // Simple value
      let parsed: unknown = value.replace(/^["']|["']$/g, '');
      if (parsed === 'true') parsed = true;
      else if (parsed === 'false') parsed = false;
      else if (/^\d+$/.test(parsed as string)) parsed = parseInt(parsed as string, 10);
      else if (/^\d+\.\d+$/.test(parsed as string)) parsed = parseFloat(parsed as string);
      current[key] = parsed;
      currentKey = key;
    }
  }

  return result;
}

/**
 * Deep merge two objects.
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (
      sourceVal &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === 'object'
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetVal,
        sourceVal as Partial<typeof targetVal>
      );
    } else if (sourceVal !== undefined) {
      (result as Record<string, unknown>)[key] = sourceVal;
    }
  }

  return result;
}

/**
 * Configuration service for loading project configs.
 */
export class ConfigService {
  private configs: Map<string, ProjectConfig> = new Map();
  private configsDir: string;

  constructor() {
    this.configsDir = PATHS.PROJECTS_DIR;
  }

  /**
   * Load all project configurations.
   */
  loadAll(): ProjectConfig[] {
    this.configs.clear();

    if (!existsSync(this.configsDir)) {
      logger.warn(`Config directory not found: ${this.configsDir}`);
      return [];
    }

    const files = readdirSync(this.configsDir).filter(
      (f) => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json')
    );

    for (const file of files) {
      try {
        const config = this.loadConfig(path.join(this.configsDir, file));
        if (config) {
          this.configs.set(config.id, config);
        }
      } catch (error) {
        logger.error(`Failed to load config: ${file}`, { error });
      }
    }

    logger.info(`Loaded ${this.configs.size} project configurations`);
    return Array.from(this.configs.values());
  }

  /**
   * Load a single configuration file.
   */
  private loadConfig(filePath: string): ProjectConfig | null {
    const content = readFileSync(filePath, 'utf-8');
    let raw: Record<string, unknown>;

    if (filePath.endsWith('.json')) {
      raw = JSON.parse(content);
    } else {
      raw = parseYaml(content);
    }

    // Extract project-level config if nested
    const projectRaw = (raw.project as Record<string, unknown>) || raw;

    if (!projectRaw.id || !projectRaw.repository) {
      logger.warn(`Invalid config (missing id or repository): ${filePath}`);
      return null;
    }

    // Merge with defaults
    const config = deepMerge(DEFAULT_CONFIG, projectRaw) as ProjectConfig;
    config.id = projectRaw.id as string;
    config.name = (projectRaw.name as string) || config.id;
    config.repository = projectRaw.repository as string;

    return config;
  }

  /**
   * Get a project configuration by ID.
   */
  get(projectId: string): ProjectConfig | undefined {
    return this.configs.get(projectId);
  }

  /**
   * Get a project by repository name.
   */
  getByRepository(repository: string): ProjectConfig | undefined {
    return Array.from(this.configs.values()).find((c) => c.repository === repository);
  }

  /**
   * Get all enabled projects.
   */
  getEnabled(): ProjectConfig[] {
    return Array.from(this.configs.values()).filter((c) => c.enabled);
  }

  /**
   * Check if a branch matches a project's trigger configuration.
   */
  matchesBranch(config: ProjectConfig, branch: string): boolean {
    return config.triggers.branches.some((pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(branch);
      }
      return pattern === branch;
    });
  }

  /**
   * Check if changed files match a project's file patterns.
   */
  matchesFilePatterns(config: ProjectConfig, files: string[]): boolean {
    const patterns = config.triggers.filePatterns;
    if (!patterns) return true;

    const { include = ['**/*'], exclude = [] } = patterns;

    // Helper to match glob pattern
    const matchesPattern = (file: string, pattern: string): boolean => {
      const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
      return regex.test(file);
    };

    // Check if any file matches include and doesn't match exclude
    return files.some((file) => {
      const included = include.some((p) => matchesPattern(file, p));
      const excluded = exclude.some((p) => matchesPattern(file, p));
      return included && !excluded;
    });
  }
}

// Export singleton instance
export const configService = new ConfigService();
