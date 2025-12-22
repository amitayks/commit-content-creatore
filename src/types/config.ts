/**
 * Project configuration types.
 */

/** Content type preferences for a project */
export type ContentType = 'technical' | 'feature' | 'learning' | 'mixed';

/** Tone settings for content generation */
export type ContentTone =
  | 'formal'
  | 'casual'
  | 'technical'
  | 'enthusiastic'
  | 'professional-casual';

/** Platform configuration for a project */
export interface PlatformConfig {
  /** X (Twitter) enabled */
  x: boolean;
  // Future: instagram, linkedin, etc.
}

/** Trigger configuration */
export interface TriggerConfig {
  /** Branches to watch (supports glob patterns) */
  branches: string[];
  /** Event types to trigger on */
  events: ('pr_merged' | 'push')[];
  /** File pattern filters */
  filePatterns?: {
    /** Include patterns (glob) */
    include?: string[];
    /** Exclude patterns (glob) */
    exclude?: string[];
  };
}

/** Content generation settings */
export interface ContentConfig {
  /** Content types to focus on */
  types: ContentType[];
  /** Tone/voice for the content */
  tone: ContentTone;
  /** Custom prompt additions */
  customPrompt?: string;
}

/** Formatting settings */
export interface FormattingConfig {
  /** Hashtags configuration */
  hashtags: {
    /** Always include these */
    always: string[];
    /** Project-specific hashtags */
    project: string[];
  };
  /** Mentions to include */
  mentions?: string[];
  /** Whether to use emojis */
  emojis: boolean;
}

/** Thread settings */
export interface ThreadConfig {
  /** Minimum commits to create a thread instead of single tweet */
  minCommitsForThread: number;
  /** Maximum tweets in a thread */
  maxTweets: number;
  /** Always generate images for threads */
  alwaysGenerateImage: boolean;
  /** Generate images for single tweets (probability 0-1) */
  singleTweetImageProbability: number;
}

/** Debounce settings for push events */
export interface DebounceConfig {
  /** Minutes to wait after push before processing */
  pushDebounceMinutes: number;
  /** Process PR events immediately */
  prImmediate: boolean;
}

/** Full project configuration */
export interface ProjectConfig {
  /** Unique project ID */
  id: string;
  /** Display name */
  name: string;
  /** GitHub repository (owner/repo format) */
  repository: string;
  /** Whether project is enabled */
  enabled: boolean;
  /** Trigger configuration */
  triggers: TriggerConfig;
  /** Content generation settings */
  content: ContentConfig;
  /** Formatting settings */
  formatting: FormattingConfig;
  /** Thread settings */
  thread: ThreadConfig;
  /** Debounce settings */
  debounce: DebounceConfig;
  /** Platforms to publish to */
  platforms: PlatformConfig;
}

/** Global application configuration */
export interface AppConfig {
  /** Telegram chat ID to send notifications */
  telegramChatId: string;
  /** Default timezone for scheduling */
  timezone: string;
  /** Daily publish limit */
  dailyPublishLimit: number;
  /** Archive retention days */
  archiveRetentionDays: number;
}
