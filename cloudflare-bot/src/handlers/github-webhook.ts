/**
 * GitHub Webhook Handler - Process incoming webhook events
 *
 * Per-user webhook verification: looks up all repos matching owner/repo,
 * tries each row's webhook_secret to identify the owning user,
 * then hydrates env with the user's API keys for processing.
 */

import type { Env, GitHubPullRequestEvent, GitHubPushEvent, DraftContent, ContentSource } from '../types';
import { getAllReposByOwnerRepo, createDraft, getDraftByCommitSha, parseRepoConfig, applyOverviewPatches } from '../services/db';
import { verifyWebhookSignature } from '../services/webhook';
import { generateContent } from '../services/gemini';
import { getPR } from '../services/github';
import { sendMessage } from '../services/telegram';
import { hydrateEnv } from '../services/user-keys';
import { logInfo, logError } from '../services/security';

interface WebhookResult {
    processed: boolean;
    message: string;
}

/**
 * Handle incoming GitHub webhook
 * Verifies signature per-repo, hydrates env with user's keys
 */
export async function handleGitHubWebhook(
    env: Env,
    request: Request
): Promise<WebhookResult> {
    const signature = request.headers.get('X-Hub-Signature-256') || '';
    const event = request.headers.get('X-GitHub-Event') || '';

    const body = await request.text();

    // Parse payload first to get owner/repo for per-repo secret lookup
    let payload: any;
    try {
        payload = JSON.parse(body);
    } catch {
        return { processed: false, message: 'Invalid JSON payload' };
    }

    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
        return { processed: false, message: 'No repository in payload' };
    }

    const [owner, repo] = repoFullName.split('/');

    // Look up all repos matching this owner/repo and verify signature against each
    const candidateRepos = await getAllReposByOwnerRepo(env, owner, repo);
    if (candidateRepos.length === 0) {
        logInfo(`Ignoring webhook for unwatched repo: ${repoFullName}`);
        return { processed: false, message: 'Repo not watched' };
    }

    // Try each repo's webhook_secret until one verifies
    let matchedRepo = null;
    for (const candidate of candidateRepos) {
        if (!candidate.webhook_secret) continue; // Skip legacy rows with NULL secret
        const isValid = await verifyWebhookSignature(candidate.webhook_secret, body, signature);
        if (isValid) {
            matchedRepo = candidate;
            break;
        }
    }

    if (!matchedRepo) {
        logInfo('No matching webhook secret for:', repoFullName);
        return { processed: false, message: 'Invalid signature' };
    }

    logInfo(`Received GitHub webhook: ${event} for ${repoFullName} (user: ${matchedRepo.chat_id})`);

    const config = parseRepoConfig(matchedRepo);
    const chatId = matchedRepo.chat_id;

    // Hydrate env with the repo owner's API keys
    const userEnv = await hydrateEnv(env, chatId);

    switch (event) {
        case 'pull_request':
            if (config.watchPRs) {
                return handlePullRequestEvent(userEnv, chatId, payload as GitHubPullRequestEvent, config, matchedRepo.id);
            }
            return { processed: false, message: 'PR watching disabled for this repo' };

        case 'push':
            if (config.watchPushes) {
                return handlePushEvent(userEnv, chatId, payload as GitHubPushEvent, config, matchedRepo.id);
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
    chatId: string,
    event: GitHubPullRequestEvent,
    config: ReturnType<typeof parseRepoConfig>,
    repoId: string
): Promise<WebhookResult> {
    if (event.action !== 'closed' || !event.pull_request.merged) {
        logInfo(`Ignoring PR event: action=${event.action}, merged=${event.pull_request.merged}`);
        return { processed: false, message: 'Not a merged PR' };
    }

    const targetBranch = event.pull_request.base.ref;
    if (!config.branches.includes(targetBranch)) {
        logInfo(`Ignoring PR merged to non-watched branch: ${targetBranch}`);
        return { processed: false, message: `Branch ${targetBranch} not watched` };
    }

    const pr = event.pull_request;
    const repoFullName = event.repository.full_name;

    logInfo(`Processing merged PR #${pr.number}: ${pr.title} in ${repoFullName}`);

    const existing = await getDraftByCommitSha(env, chatId, pr.head.sha);
    if (existing) {
        logInfo(`Draft already exists for commit ${pr.head.sha.slice(0, 7)}, skipping`);
        return { processed: true, message: `Draft already exists for PR #${pr.number}` };
    }

    try {
        const prData = await getPR(env, repoFullName, pr.number);

        const contentSource: ContentSource = {
            type: 'pr',
            data: prData,
        };

        const result = await generateContent(env, contentSource, repoId);
        const draftContent = result.content;

        if (result.overviewUpdates) {
            try {
                await applyOverviewPatches(env, repoId, result.overviewUpdates);
            } catch (patchError) {
                logError('Overview patch failed (non-blocking):', patchError);
            }
        }

        const repoShort = repoFullName.split('/')[1] || repoFullName;
        const draftId = await createDraft(env, chatId, {
            pr_number: pr.number,
            pr_title: `${repoShort} | ${pr.title}`,
            commit_sha: pr.head.sha,
            content: JSON.stringify(draftContent),
        });

        try {
            await sendNotification(env, chatId, 'pr', pr.number, pr.title, repoFullName, draftId, draftContent);
        } catch (notifyError) {
            logError('Telegram notification failed (draft saved):', notifyError);
        }

        return { processed: true, message: `Created draft for PR #${pr.number}` };
    } catch (error) {
        logError('Error processing PR webhook:', error);
        return { processed: false, message: String(error) };
    }
}

/**
 * Handle push event
 */
async function handlePushEvent(
    env: Env,
    chatId: string,
    event: GitHubPushEvent,
    config: ReturnType<typeof parseRepoConfig>,
    repoId: string
): Promise<WebhookResult> {
    const refParts = event.ref.split('/');
    const branch = refParts[refParts.length - 1];

    if (!config.branches.includes(branch)) {
        logInfo(`Ignoring push to non-watched branch: ${branch}`);
        return { processed: false, message: `Branch ${branch} not watched` };
    }

    if (!event.head_commit) {
        return { processed: false, message: 'No head commit in push' };
    }

    const repoFullName = event.repository.full_name;
    const commit = event.head_commit;

    logInfo(`Processing push to ${branch}: ${commit.message.split('\n')[0]}`);

    const existing = await getDraftByCommitSha(env, chatId, commit.id);
    if (existing) {
        logInfo(`Draft already exists for commit ${commit.id.slice(0, 7)}, skipping`);
        return { processed: true, message: `Draft already exists for push ${commit.id.slice(0, 7)}` };
    }

    try {
        const commitMessages = event.commits.map(c => c.message.split('\n')[0]);

        const fileSet = new Set<string>();
        for (const c of event.commits) {
            for (const f of [...c.added, ...c.modified, ...c.removed]) {
                fileSet.add(f);
            }
        }
        const fileNames = Array.from(fileSet);
        const totalFiles = fileNames.length;

        const contentSource: ContentSource = {
            type: 'commit',
            data: {
                sha: commit.id,
                title: commit.message.split('\n')[0],
                body: commit.message.split('\n').slice(1).join('\n').trim(),
                commitMessages,
                fileNames,
                files_changed: totalFiles,
                additions: 0,
                deletions: 0,
                author: commit.author.username || commit.author.name,
                date: commit.timestamp || new Date().toISOString(),
            },
        };

        const result = await generateContent(env, contentSource, repoId);
        const draftContent = result.content;

        if (result.overviewUpdates) {
            try {
                await applyOverviewPatches(env, repoId, result.overviewUpdates);
            } catch (patchError) {
                logError('Overview patch failed (non-blocking):', patchError);
            }
        }

        const repoShort = repoFullName.split('/')[1] || repoFullName;
        const draftId = await createDraft(env, chatId, {
            pr_number: 0,
            pr_title: `${repoShort} | ${commit.message.split('\n')[0]}`,
            commit_sha: commit.id,
            content: JSON.stringify(draftContent),
        });

        try {
            await sendNotification(env, chatId, 'push', event.commits.length, commit.message.split('\n')[0], repoFullName, draftId, draftContent);
        } catch (notifyError) {
            logError('Telegram notification failed (draft saved):', notifyError);
        }

        return { processed: true, message: `Created draft for push ${commit.id.slice(0, 7)}` };
    } catch (error) {
        logError('Error processing push webhook:', error);
        return { processed: false, message: String(error) };
    }
}

/**
 * Send Telegram notification for auto-generated content
 * Sends to the repo owner's chatId (not admin)
 */
async function sendNotification(
    env: Env,
    chatId: string,
    eventType: 'pr' | 'push',
    number: number,
    title: string,
    repo: string,
    draftId: string,
    content: DraftContent
): Promise<void> {
    const emoji = eventType === 'pr' ? '🔀' : '📤';
    const eventLabel = eventType === 'pr' ? `PR #${number} Merged` : `${number} commit${number > 1 ? 's' : ''} pushed`;

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
            { text: '✅ Approve', callback_data: `action:approve:${draftId}` },
            { text: '👀 View', callback_data: `draft:${draftId}` },
        ],
        [
            { text: '✏️ Edit', callback_data: `action:edit:${draftId}` },
            { text: '🗑 Delete', callback_data: `action:delete_draft:${draftId}` },
        ],
    ];

    await sendMessage(env, chatId, text, keyboard);
}
