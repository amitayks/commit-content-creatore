/**
 * Shared types for the Cloudflare Bot
 */

// Environment bindings
export interface Env {
    DB: D1Database;
    IMAGES: R2Bucket;
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_CHAT_ID: string;
    GITHUB_TOKEN: string;
    GITHUB_OWNER?: string;
    GITHUB_WEBHOOK_SECRET?: string;
    X_API_KEY: string;
    X_API_SECRET: string;
    X_ACCESS_TOKEN: string;
    X_ACCESS_SECRET: string;
    // Google API key for Gemini image generation
    GOOGLE_API_KEY: string;
    // Security: Admin secret for protected endpoints
    ADMIN_SECRET?: string;
    // HeyGen API key for video generation
    HEYGEN_API_KEY?: string;
    // Instagram credentials
    INSTAGRAM_ACCESS_TOKEN?: string;
    INSTAGRAM_BUSINESS_ACCOUNT_ID?: string;
    // Multi-tenant: encryption key for user API keys (AES-256-GCM, 32 bytes base64)
    ENCRYPTION_KEY: string;
    // Multi-tenant: max registered users (default 50)
    MAX_USERS?: string;
    // Multi-tenant: preserved admin chat ID (set during env hydration)
    ADMIN_CHAT_ID?: string;
    // Worker URL for cron fan-out self-fetch
    WORKER_URL?: string;
}

// ==================== MULTI-TENANT USER ====================

// User status
export type UserStatus = 'onboarding' | 'active' | 'suspended';

// Onboarding step
export type OnboardingStep = 'welcome' | 'gemini_key' | 'x_keys' | 'github_token' | 'complete' | null;

// User record from D1 (merged with former chat_state)
export interface User {
    chat_id: string;
    username: string | null;
    display_name: string | null;
    status: UserStatus;
    onboarding_step: OnboardingStep;

    // Encrypted API keys
    gemini_key_enc: string | null;
    x_api_key_enc: string | null;
    x_api_secret_enc: string | null;
    x_access_token_enc: string | null;
    x_access_secret_enc: string | null;
    github_token_enc: string | null;
    heygen_api_key_enc: string | null;
    instagram_token_enc: string | null;
    instagram_account_id_enc: string | null;

    // Feature flags
    has_gemini: number;
    has_x: number;
    has_github: number;
    has_heygen: number;
    has_instagram: number;

    // UI state (from former chat_state)
    message_id: number | null;
    current_view: string;
    context: string | null;

    // Settings
    timezone: string;
    page_size: number;
    video_settings: string | null;

    // Rate limiting
    daily_generates: number;
    daily_reposts: number;
    last_reset_date: string | null;
    consecutive_failures: number;

    // Timestamps
    created_at: string;
    last_active_at: string | null;
    updated_at: string;
}

// Draft status
export type DraftStatus = 'draft' | 'approved' | 'published' | 'scheduled';

// Draft format
export type DraftFormat = 'single' | 'thread';

// Tweet in a draft
export interface Tweet {
    text: string;
    index: number;
    mediaKey?: string;
    mediaType?: 'photo';
}

// Structured image prompt for AI image generation
export interface ImagePromptData {
    concept: {
        main_subject: string;
        symbolic_elements: string;
        mood: string;
    };
    composition: {
        style: string;
        perspective: string;
        focal_point: string;
    };
    environment: {
        setting: string;
        lighting: string;
        color_palette: string;
    };
    technical: {
        medium: string;
        quality: string;
        negative: string;
    };
}

// Draft content structure
export interface DraftContent {
    format: DraftFormat;
    tweets: Tweet[];
    imagePrompt?: ImagePromptData | string; // Structured object (new) or string (legacy)
}

// Extended content response that includes overview patches
export interface ContentResponse {
    content: DraftContent;
    overviewUpdates: OverviewPatch | null;
}

// Draft record from D1
export interface Draft {
    id: string;
    chat_id: string; // Owner's Telegram chat ID
    pr_number: number;
    pr_title: string;
    commit_sha: string;
    source: string; // 'auto' | 'handwrite' | 'repost'
    status: DraftStatus;
    content: string; // JSON string of DraftContent
    image_url: string | null;
    scheduled_at: string | null;
    original_tweet_id: string | null; // For repost drafts: the quoted tweet ID
    original_tweet_url: string | null; // For repost drafts: URL to original tweet
    created_at: string;
    updated_at: string;
}

// Chat state for conversation tracking (now stored in users table)
export interface ChatState {
    chat_id: string;
    message_id: number | null;
    current_view: string;
    context: string | null; // JSON for pagination, selected draft, etc.
    timezone: string; // UTC offset, e.g. 'UTC', 'UTC+2', 'UTC-5:30'
    updated_at: string;
}

// Published post record
export interface Published {
    id: string;
    chat_id: string; // Owner's Telegram chat ID
    draft_id: string;
    pr_number: number;
    tweet_ids: string; // JSON array
    tweet_url: string | null;
    image_url: string | null;
    published_at: string;
}

// ==================== REPO WATCHING ====================

// Repo configuration for content generation
export interface RepoConfig {
    includeHashtags: boolean;
    watchPRs: boolean;
    watchPushes: boolean;
    branches: string[];
    platform: 'x';

    // Content language
    language: 'en' | 'he';

    // Thread settings
    minCommitsForThread: number;
    maxTweets: number;

    // Image settings
    alwaysGenerateThreadImage: boolean;
    singleTweetImageProbability: number;
}

// Watched repo record from D1
export interface WatchedRepo {
    id: string;
    chat_id: string; // Owner's Telegram chat ID
    owner: string;
    repo: string;
    is_watching: number; // 0 or 1
    config: string; // JSON string of RepoConfig
    webhook_id: string | null;
    webhook_secret: string | null;
    created_at: string;
    updated_at: string;
}

// Default config for new repos
export const DEFAULT_REPO_CONFIG: RepoConfig = {
    includeHashtags: true,
    watchPRs: true,
    watchPushes: false,
    branches: ['main'],
    platform: 'x',
    language: 'en',
    minCommitsForThread: 3,
    maxTweets: 10,
    alwaysGenerateThreadImage: true,
    singleTweetImageProbability: 0.7,
};

// ==================== REPO OVERVIEW ====================

// Persistent repo context for content generation
export interface RepoOverview {
    id: string;
    repo_id: string;
    summary: string | null;
    tech_stack: string | null;
    key_features: string[];  // Stored as JSON in D1
    target_audience: string | null;
    brand_voice: string | null;
    visual_theme: string | null;
    recent_changes: string[];  // Stored as JSON in D1, max 20 items FIFO
    version: number;
    created_at: string;
    updated_at: string;
}

// Field-level patch for overview auto-updates from Gemini
// null = no change, string = replace scalar, { add, remove } = modify array
export interface OverviewPatch {
    summary?: string | null;
    tech_stack?: string | null;
    key_features?: { add: string[]; remove: string[] } | null;
    target_audience?: string | null;
    brand_voice?: string | null;
    visual_theme?: string | null;
    recent_changes?: { add: string[]; remove: string[] } | null;
}

// ==================== VIDEO STUDIO ====================

// Video draft status
export type VideoDraftStatus = 'draft' | 'generating' | 'queued' | 'completed' | 'approved' | 'scheduled' | 'published' | 'failed';

// Valid HeyGen voice emotions
export type HeyGenEmotion = 'Excited' | 'Friendly' | 'Serious' | 'Soothing' | 'Broadcaster';

// Video configuration for a single video generation
export interface VideoConfig {
    commitDepth: number | 'since_last_video' | 'custom';
    tone: string;
    length: string; // '30s' | '60s' | '90s' | '2m' | '3m' | '5m'
    characterId?: string;
    lookId?: string;
    talkingPhotoId?: string;
    imageKey?: string;
    voiceId?: string;
    aspectRatio: '9:16' | '16:9' | '1:1';
    emotion: HeyGenEmotion;
    background: { type: 'default' } | { type: 'color'; value: string } | { type: 'image'; url: string };
    captions: boolean;
    textOverlay: boolean;
    manualInstructions?: string;
}

// Default video config
export const DEFAULT_VIDEO_CONFIG: VideoConfig = {
    commitDepth: 3,
    tone: 'Casual Update',
    length: '60s',
    aspectRatio: '9:16',
    emotion: 'Friendly',
    background: { type: 'default' },
    captions: true,
    textOverlay: false,
};

// Video scene from Gemini script generation
export interface VideoScene {
    scriptText: string;
    emotion: HeyGenEmotion;
    motionPrompt: string;
    textOverlay?: string;
}

// Gemini video script response
export interface VideoScriptResponse {
    title: string;
    scenes: VideoScene[];
    caption: string;        // Instagram caption (max 2200 chars)
    twitterCaption: string; // Twitter caption (max 280 chars)
    totalWordCount: number;
}

// Video draft record from D1
export interface VideoDraft {
    id: string;
    chat_id: string;
    repo_id: string | null;
    status: VideoDraftStatus;
    script: string | null;     // JSON string of VideoScriptResponse
    caption: string | null;
    twitter_caption: string | null;
    title: string | null;
    config: string | null;     // JSON string of VideoConfig
    heygen_video_id: string | null;
    video_url: string | null;  // R2 key
    reference_sha: string | null;
    scheduled_at: string | null;
    created_at: string;
    updated_at: string;
}

// Video published record from D1
export interface VideoPublished {
    id: string;
    chat_id: string;
    video_draft_id: string;
    repo_id: string | null;
    twitter_url: string | null;
    instagram_url: string | null;
    caption: string | null;
    published_at: string;
}

// Video preset record from D1
export interface VideoPreset {
    id: string;
    chat_id: string;
    name: string;
    config: string; // JSON string of VideoConfig
    created_at: string;
}

// HeyGen job status response
export interface HeyGenJobStatus {
    video_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    video_url?: string;
    error?: string;
}

// HeyGen webhook callback payload
export interface HeyGenWebhookPayload {
    event_type: 'avatar_video.success' | 'avatar_video.fail';
    event_data: {
        video_id: string;
        url?: string;
        error?: string;
        callback_id?: string;
    };
}

// HeyGen character (stored in chat settings JSON)
export interface HeyGenCharacter {
    heygenGroupId: string;
    name: string;
    personality?: string;
    defaultTalkingPhotoId?: string;
    voiceId?: string;
    defaultEmotion: HeyGenEmotion;
    status: 'ready' | 'training' | 'failed';
    looks: HeyGenLook[];
    createdAt: string;
}

// HeyGen look (talking photo variant)
export interface HeyGenLook {
    talkingPhotoId: string;
    imageKey: string;
    name: string;
}

// Video settings (persisted per-chat as JSON in users.video_settings)
export interface VideoSettings {
    characters: HeyGenCharacter[];
    defaults: {
        aspectRatio?: string;
        maxLength?: string;
        defaultCharacterId?: string;
        defaultBackground?: string;
        defaultCaptions?: boolean;
    };
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
    characters: [],
    defaults: {},
};

// ==================== TWITTER REPOST SYSTEM ====================

// Twitter account configuration
export interface TwitterAccountConfig {
    language: 'en' | 'he';
    includeHashtags: boolean;
    alwaysGenerateImage: boolean;
    singleImageProbability: number;
    relevanceThreshold: number; // 1-10
    tone: 'professional' | 'casual' | 'analytical' | 'enthusiastic' | 'witty' | 'sarcastic';
    autoApprove: boolean;
    batchPageSize: number; // tweets per batch notification page
    analyzeMedia: boolean;
}

export const DEFAULT_TWITTER_ACCOUNT_CONFIG: TwitterAccountConfig = {
    language: 'en',
    includeHashtags: true,
    alwaysGenerateImage: false,
    singleImageProbability: 0.3,
    relevanceThreshold: 6,
    tone: 'professional',
    autoApprove: false,
    batchPageSize: 5,
    analyzeMedia: true,
};

// Followed Twitter account record from D1
export interface TwitterAccount {
    id: string;
    chat_id: string;
    username: string;
    user_id: string | null;
    display_name: string | null;
    is_watching: number; // 0 or 1
    last_tweet_id: string | null;
    config: string; // JSON string of TwitterAccountConfig
    thread_buffer: string | null; // JSON for incomplete thread tracking
    created_at: string;
    updated_at: string;
}

// AI-generated persona overview for a Twitter account
export interface TwitterAccountOverview {
    id: string;
    account_id: string;
    persona: string | null;
    topics: string | null; // JSON array
    communication_style: string | null;
    notable_context: string | null;
    recent_themes: string | null; // JSON array
    version: number;
    created_at: string;
    updated_at: string;
}

// Persona cache for non-followed accounts
export interface PersonaCache {
    id: string;
    username: string; // UNIQUE
    user_id: string | null;
    display_name: string | null;
    bio: string | null;
    persona: string | null;
    topics: string | null; // JSON array
    created_at: string;
    updated_at: string;
}

// Tweet record from D1
export type TwitterTweetStatus = 'pending' | 'buffered' | 'scored' | 'drafted' | 'skipped';

export interface TwitterTweet {
    id: string; // Tweet ID from X
    account_id: string;
    chat_id: string;
    conversation_id: string | null;
    thread_position: number;
    is_thread: number; // 0 or 1
    text: string;
    author_username: string;
    metrics: string | null; // JSON
    tweet_url: string | null;
    tweeted_at: string | null;
    relevance_score: number | null;
    relevance_reason: string | null;
    status: TwitterTweetStatus;
    draft_id: string | null;
    batch_message_id: number | null;
    media_url: string | null;
    created_at: string;
}

// Thread buffer entry tracked per conversation_id
export interface ThreadBufferEntry {
    tweet_ids: string[];
    stale_polls: number;
}

// ==================== GITHUB WEBHOOKS ====================

// GitHub webhook pull request event
export interface GitHubPullRequestEvent {
    action: string;
    pull_request: {
        number: number;
        title: string;
        body: string | null;
        merged: boolean;
        merged_at: string | null;
        base: { ref: string };
        head: { sha: string };
        user: { login: string };
        additions: number;
        deletions: number;
        changed_files: number;
    };
    repository: {
        full_name: string;
        owner: { login: string };
        name: string;
    };
}

// GitHub webhook push event
export interface GitHubPushEvent {
    ref: string;
    commits: Array<{
        id: string;
        message: string;
        author: { name: string; username?: string };
        added: string[];
        modified: string[];
        removed: string[];
    }>;
    head_commit: {
        id: string;
        message: string;
        timestamp: string;
        author: { name: string; username?: string };
    } | null;
    repository: {
        full_name: string;
        owner: { login: string };
        name: string;
    };
    pusher: { name: string };
}

// ==================== PR & COMMIT DATA ====================

// PR data from GitHub
export interface PRData {
    number: number;
    title: string;
    body: string;
    commits: string[];
    commitMessages: string[];
    fileNames: string[];
    files_changed: number;
    additions: number;
    deletions: number;
    merged_at: string;
    author: string;
}

// Direct commit data (fallback when no PR)
export interface CommitData {
    sha: string;
    title: string;
    body: string;
    commitMessages: string[];
    fileNames: string[];
    files_changed: number;
    additions: number;
    deletions: number;
    author: string;
    date: string;
}

// Union type for content generation source
export type ContentSource =
    | { type: 'pr'; data: PRData; repo?: string }
    | { type: 'commit'; data: CommitData; repo?: string };

// ==================== TELEGRAM ====================

// Telegram inline button
export interface InlineButton {
    text: string;
    callback_data?: string;
    url?: string;
    style?: 'primary' | 'success' | 'danger';
}

// View render result
export interface ViewResult {
    text: string;
    keyboard: InlineButton[][];
}

// Telegram message
export interface TelegramMessage {
    message_id: number;
    chat: { id: number };
    text?: string;
    caption?: string;
    photo?: Array<{ file_id: string; file_size?: number; width?: number; height?: number }>;
    from?: { id: number; first_name: string };
}

// Telegram callback query
export interface TelegramCallbackQuery {
    id: string;
    from: { id: number; first_name: string };
    message?: TelegramMessage;
    data?: string;
}

// Telegram update
export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    edited_message?: TelegramMessage;
    callback_query?: TelegramCallbackQuery;
}

// Context for stateful operations
export interface ChatContext {
    awaiting_input?: 'commit_sha' | 'schedule' | 'schedule_time' | 'delete' | 'add_repo' | 'add_account' | 'edit_draft' | 'handwrite' | 'timezone' | 'edit_overview' | 'video_preset_name' | 'edit_character' | 'repost_url' | 'update_key';
    key_service?: 'gemini' | 'x' | 'github' | 'instagram';
    handwrite?: HandwriteState;
    videoCompose?: VideoComposeState;
    characterCreate?: CharacterCreateState;
    lookCreate?: LookCreateState;
    voiceSelect?: { groupId: string; voiceIds: string[] };
    selectedCharGroupId?: string;
    selected_account_id?: string;
    schedule_date?: string; // YYYY-MM-DD for day picker flow
    repost_preview?: {
        tweet_id: string;
        username: string;
        tweet_text: string;
        thread_text?: string;
        author_name: string | null;
        author_bio: string | null;
        is_followed: boolean;
        selected_tone: TwitterAccountConfig['tone'];
        user_id: string | null;
        media_url?: string | null;
    };
    page?: number;
    selected_draft_id?: string;
    selected_repo_id?: string;
    selected_video_draft_id?: string;
    draft_list_type?: string;
    draft_list_page?: number;
    overview_field?: string;
    video_config?: VideoConfig;
}

// Video compose mode for manual instructions
export interface VideoComposeState {
    active: boolean;
    repoId?: string;
    instructions: string[];
    config?: VideoConfig;
}

// Character creation compose mode
export interface CharacterCreateState {
    active: boolean;
    step: 'awaiting_photos' | 'awaiting_name';
    assetIds: string[];
}

// Look creation compose mode
export interface LookCreateState {
    active: boolean;
    step: 'awaiting_photo' | 'awaiting_name';
    characterGroupId: string;
    imageKey?: string;
}

// Handwrite compose mode types
export interface HandwriteTweet {
    messageId: number;
    text: string;
    mediaKey?: string;
    mediaType?: 'photo';
}

export interface HandwriteState {
    tweets: HandwriteTweet[];
    imageGen: boolean;
    aiRefine: boolean;
    statusMessageId: number;
}

