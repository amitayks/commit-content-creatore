import type { HandlerContext } from '../core/router';
import { getRepoByOwnerRepo, getRepo, upsertRepoOverview } from '../services/db';
import { fetchRepoReadme, fetchRecentMergedPRs } from '../services/github';
import { extractRepoOverview } from '../services/gemini';
import { sendMessage } from '../services/telegram';

export async function overviewCommand(ctx: HandlerContext) {
    const { env, chatId, args } = ctx;

    // Check if args is a repo ID (from "Re-bootstrap" button) or owner/repo format
    let owner: string;
    let repo: string;
    let repoId: string;

    if (args && args.includes('/')) {
        // owner/repo format from command
        const parts = args.trim().split('/');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            await sendMessage(env, chatId,
                '❌ Invalid format.\n\nUsage: <code>/overview owner/repo</code>',
                [[{ text: '🏠 Home', callback_data: 'view:home' }]]
            );
            return;
        }
        [owner, repo] = parts;

        const watchedRepo = await getRepoByOwnerRepo(env, chatId, owner, repo);
        if (!watchedRepo) {
            await sendMessage(env, chatId,
                `❌ Repository <code>${owner}/${repo}</code> is not in your watched repos.\n\nAdd it first with /watch.`,
                [[{ text: '🏠 Home', callback_data: 'view:home' }]]
            );
            return;
        }
        repoId = watchedRepo.id;
    } else if (args) {
        // Assume it's a repo ID (from Re-bootstrap button)
        const watchedRepo = await getRepo(env, args, chatId);
        if (!watchedRepo) {
            await sendMessage(env, chatId,
                '❌ Repository not found.',
                [[{ text: '🏠 Home', callback_data: 'view:home' }]]
            );
            return;
        }
        owner = watchedRepo.owner;
        repo = watchedRepo.repo;
        repoId = watchedRepo.id;
    } else {
        await sendMessage(env, chatId,
            '❌ Please specify a repository.\n\nUsage: <code>/overview owner/repo</code>',
            [[{ text: '🏠 Home', callback_data: 'view:home' }]]
        );
        return;
    }

    // Send progress message
    const progressMsgId = await sendMessage(env, chatId,
        `🔍 Bootstrapping overview for <code>${owner}/${repo}</code>...\n\nFetching README and recent PRs...`
    );

    try {
        // Fetch README and recent PRs in parallel
        const [readmeText, prSummaries] = await Promise.all([
            fetchRepoReadme(env, owner, repo),
            fetchRecentMergedPRs(env, owner, repo, 10),
        ]);

        // Extract overview via Gemini
        const overview = await extractRepoOverview(env, readmeText, prSummaries);

        // Store in D1
        await upsertRepoOverview(env, repoId, overview);

        // Build preview message
        const lines: string[] = ['✅ <b>Overview bootstrapped!</b>\n'];

        if (overview.summary) {
            lines.push(`📋 <b>Summary:</b> ${overview.summary}\n`);
        }
        if (overview.tech_stack) {
            lines.push(`🛠 <b>Tech Stack:</b> ${overview.tech_stack}\n`);
        }
        if (overview.key_features.length > 0) {
            lines.push(`⭐ <b>Key Features:</b> ${overview.key_features.join(', ')}\n`);
        }
        if (overview.target_audience) {
            lines.push(`👥 <b>Target Audience:</b> ${overview.target_audience}\n`);
        }
        if (overview.brand_voice) {
            lines.push(`🎤 <b>Brand Voice:</b> ${overview.brand_voice}\n`);
        }
        if (overview.visual_theme) {
            lines.push(`🎨 <b>Visual Theme:</b> ${overview.visual_theme}\n`);
        }

        lines.push('This context will now be used when generating content for this repo.');

        await sendMessage(env, chatId, lines.join('\n'), [
            [{ text: '🏠 Home', callback_data: 'view:home' }],
        ]);
    } catch (error) {
        console.error('Overview bootstrap error:', error);
        await sendMessage(env, chatId,
            `❌ Failed to bootstrap overview for <code>${owner}/${repo}</code>.\n\nPlease try again.`,
            [[{ text: '🏠 Home', callback_data: 'view:home' }]]
        );
    }
}
