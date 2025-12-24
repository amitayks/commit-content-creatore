/**
 * GitHub Webhook Handler - Process incoming webhook events
 */

import type { Env, GitHubPullRequestEvent, GitHubPushEvent, DraftContent, ContentSource } from '../types';
import { getWatchingRepos, getRepoByOwnerRepo, createDraft, parseRepoConfig, updateDraft } from '../services/db';
import { verifyWebhookSignature } from '../services/webhook';
import { generateContent, generateAndStoreImage } from '../services/grok';
import { sendMessage, sendPhoto } from '../services/telegram';

interface WebhookResult {
    processed: boolean;
    message: string;
}

/**
 * Handle incoming GitHub webhook
 */
export async function handleGitHubWebhook(
    env: Env,
    request: Request
): Promise<WebhookResult> {
    // Get the signature header
    const signature = request.headers.get('X-Hub-Signature-256') || '';
    const event = request.headers.get('X-GitHub-Event') || '';

    // Read body
    const body = await request.text();

    // Verify signature
    const isValid = await verifyWebhookSignature(env.GITHUB_WEBHOOK_SECRET, body, signature);
    if (!isValid) {
        console.log('Invalid webhook signature');
        return { processed: false, message: 'Invalid signature' };
    }

    console.log(`Received GitHub webhook: ${event}`);

    // Parse payload
    const payload = JSON.parse(body);

    // Get repo info
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
        return { processed: false, message: 'No repository in payload' };
    }

    const [owner, repo] = repoFullName.split('/');

    // Check if this repo is being watched
    const watchedRepo = await getRepoByOwnerRepo(env, owner, repo);
    if (!watchedRepo || !watchedRepo.is_watching) {
        console.log(`Ignoring webhook for unwatched repo: ${repoFullName}`);
        return { processed: false, message: 'Repo not watched' };
    }

    const config = parseRepoConfig(watchedRepo);

    // Handle based on event type
    switch (event) {
        case 'pull_request':
            if (config.watchPRs) {
                return handlePullRequestEvent(env, payload as GitHubPullRequestEvent, config);
            }
            return { processed: false, message: 'PR watching disabled for this repo' };

        case 'push':
            if (config.watchPushes) {
                return handlePushEvent(env, payload as GitHubPushEvent, config);
            }
            return { processed: false, message: 'Push watching disabled for this repo' };

        default:
            return { processed: false, message: `Unhandled event: ${event}` };
    }
}

/**
 * Handle pull_request event
 */
async function handlePullRequestEvent(
    env: Env,
    event: GitHubPullRequestEvent,
    config: ReturnType<typeof parseRepoConfig>
): Promise<WebhookResult> {
    // Only process merged PRs
    if (event.action !== 'closed' || !event.pull_request.merged) {
        console.log(`Ignoring PR event: action=${event.action}, merged=${event.pull_request.merged}`);
        return { processed: false, message: 'Not a merged PR' };
    }

    // Check if target branch is in watched branches
    const targetBranch = event.pull_request.base.ref;
    if (!config.branches.includes(targetBranch)) {
        console.log(`Ignoring PR merged to non-watched branch: ${targetBranch}`);
        return { processed: false, message: `Branch ${targetBranch} not watched` };
    }

    const pr = event.pull_request;
    const repoFullName = event.repository.full_name;

    console.log(`Processing merged PR #${pr.number}: ${pr.title} in ${repoFullName}`);

    try {
        // Build ContentSource from webhook data
        const contentSource: ContentSource = {
            type: 'pr',
            data: {
                number: pr.number,
                title: pr.title,
                body: pr.body || '',
                commits: [pr.head.sha],
                files_changed: pr.changed_files,
                additions: pr.additions,
                deletions: pr.deletions,
                merged_at: pr.merged_at || new Date().toISOString(),
                author: pr.user.login,
            },
        };

        // Generate content
        const draftContent = await generateContent(env, contentSource);

        // Save draft
        const draftId = await createDraft(env, {
            pr_number: pr.number,
            pr_title: pr.title,
            commit_sha: pr.head.sha,
            content: JSON.stringify(draftContent),
        });

        // Send notification to Telegram
        await sendNotification(
            env,
            'pr',
            pr.number,
            pr.title,
            repoFullName,
            draftId,
            draftContent
        );

        return { processed: true, message: `Created draft for PR #${pr.number}` };
    } catch (error) {
        console.error('Error processing PR webhook:', error);
        return { processed: false, message: String(error) };
    }
}

/**
 * Handle push event
 */
async function handlePushEvent(
    env: Env,
    event: GitHubPushEvent,
    config: ReturnType<typeof parseRepoConfig>
): Promise<WebhookResult> {
    // Check if target branch is in watched branches
    const refParts = event.ref.split('/');
    const branch = refParts[refParts.length - 1];

    if (!config.branches.includes(branch)) {
        console.log(`Ignoring push to non-watched branch: ${branch}`);
        return { processed: false, message: `Branch ${branch} not watched` };
    }

    if (!event.head_commit) {
        return { processed: false, message: 'No head commit in push' };
    }

    const repoFullName = event.repository.full_name;
    const commit = event.head_commit;

    console.log(`Processing push to ${branch}: ${commit.message.split('\n')[0]}`);

    try {
        // Count file changes from all commits
        const totalFiles = event.commits.reduce((sum, c) =>
            sum + c.added.length + c.modified.length + c.removed.length, 0
        );

        // Build ContentSource from webhook data
        const contentSource: ContentSource = {
            type: 'commit',
            data: {
                sha: commit.id,
                title: commit.message.split('\n')[0],
                body: commit.message.split('\n').slice(1).join('\n').trim(),
                files_changed: totalFiles,
                additions: 0, // Webhook doesn't provide this
                deletions: 0, // Webhook doesn't provide this
                author: commit.author.username || commit.author.name,
                date: new Date().toISOString(),
            },
        };

        // Generate content
        const draftContent = await generateContent(env, contentSource);

        // Save draft
        const draftId = await createDraft(env, {
            pr_number: 0, // No PR for direct pushes
            pr_title: commit.message.split('\n')[0],
            commit_sha: commit.id,
            content: JSON.stringify(draftContent),
        });

        // Send notification FIRST to avoid timeout
        await sendNotification(
            env,
            'push',
            event.commits.length,
            commit.message.split('\n')[0],
            repoFullName,
            draftId,
            draftContent,
            null // No image yet
        );

        // Try to generate image after notification (may timeout but notification is sent)
        const shouldGenImage = draftContent.format === 'thread'
            ? config.alwaysGenerateThreadImage
            : Math.random() < config.singleTweetImageProbability;

        if (shouldGenImage) {
            try {
                console.log('Generating image for webhook draft...');
                const imageKey = await generateAndStoreImage(env, draftContent, draftId);
                if (imageKey) {
                    await updateDraft(env, draftId, { image_url: imageKey });
                    console.log('Image generated and stored:', imageKey);
                }
            } catch (imgError) {
                console.error('Image generation failed (non-fatal):', imgError);
            }
        }

        return { processed: true, message: `Created draft for push ${commit.id.slice(0, 7)}` };
    } catch (error) {
        console.error('Error processing push webhook:', error);
        return { processed: false, message: String(error) };
    }
}

/**
 * Send Telegram notification for auto-generated content
 */
async function sendNotification(
    env: Env,
    eventType: 'pr' | 'push',
    number: number,
    title: string,
    repo: string,
    draftId: string,
    content: DraftContent,
    imageKey?: string | null
): Promise<void> {
    const emoji = eventType === 'pr' ? '🔀' : '📤';
    const eventLabel = eventType === 'pr' ? `PR #${number} Merged` : `${number} commit${number > 1 ? 's' : ''} pushed`;

    // Preview first tweet
    const preview = content.tweets[0]?.text.slice(0, 100) || '';
    const threadInfo = content.format === 'thread' ? ` (${content.tweets.length} tweets)` : '';

    const text = `${emoji} <b>New ${eventLabel}!</b>

<b>Repo:</b> <code>${repo}</code>
<b>Title:</b> ${title}

<b>Generated Content${threadInfo}:</b>
<i>${preview}${preview.length === 100 ? '...' : ''}</i>

I've auto-generated content for this. Review and approve?`;

    const keyboard = [
        [
            { text: '🚀 Publish', callback_data: `action:approve:${draftId}` },
            { text: '👀 View', callback_data: `draft:${draftId}` },
        ],
        [
            { text: '❌ Skip', callback_data: `action:reject:${draftId}` },
            { text: '🔄 Regenerate', callback_data: `action:regenerate:${draftId}` },
        ],
    ];

    // If we have an image stored in R2, we need to construct a full URL
    // For now, use text-only notification since R2 images need worker URL
    if (imageKey) {
        // Note: To send R2 images via Telegram, we'd need full URL access
        // For now, just note in the message that image was generated
        const textWithImage = text + '\n\n🖼️ <i>Image generated and attached to draft</i>';
        await sendMessage(env, env.TELEGRAM_CHAT_ID, textWithImage, keyboard);
    } else {
        await sendMessage(env, env.TELEGRAM_CHAT_ID, text, keyboard);
    }
}

