import type { HandlerContext } from '../core/router';
import type { ViewResult } from '../types';
import { updateChatState, getRepo, updateRepo, deleteRepo } from '../services/db';
import { deleteWebhook } from '../services/webhook';
import { renderRepoDetail, renderAddRepo, renderDeleteRepoConfirm, renderError } from '../views';

export async function addRepoAction(ctx: HandlerContext): Promise<ViewResult> {
    await updateChatState(ctx.env, ctx.chatId, {
        current_view: 'add_repo',
        context: { awaiting_input: 'add_repo' },
    });
    return renderAddRepo();
}

export async function watchAction(ctx: HandlerContext & { extra?: string }): Promise<ViewResult> {
    const repoId = ctx.extra!;
    await updateRepo(ctx.env, repoId, ctx.chatId, { is_watching: 1 });
    return renderRepoDetail(ctx.env, ctx.chatId, repoId);
}

export async function unwatchAction(ctx: HandlerContext & { extra?: string }): Promise<ViewResult> {
    const repoId = ctx.extra!;
    await updateRepo(ctx.env, repoId, ctx.chatId, { is_watching: 0 });
    return renderRepoDetail(ctx.env, ctx.chatId, repoId);
}

export async function deleteRepoAction(ctx: HandlerContext & { extra?: string }): Promise<ViewResult> {
    const repoId = ctx.extra!;
    return renderDeleteRepoConfirm(ctx.env, ctx.chatId, repoId);
}

export async function confirmDeleteRepoAction(ctx: HandlerContext & { extra?: string }): Promise<ViewResult> {
    const { env, chatId } = ctx;
    const repoId = ctx.extra!;
    const repo = await getRepo(env, repoId, chatId);
    if (!repo) {
        return renderError('Repository not found.');
    }

    if (repo.webhook_id) {
        try {
            await deleteWebhook(env, repo.owner, repo.repo, repo.webhook_id);
        } catch { /* Continue even if webhook deletion fails */ }
    }

    await deleteRepo(env, repoId, chatId);
    return {
        text: `✅ <b>Repository Deleted</b>\n\n<code>${repo.owner}/${repo.repo}</code> has been removed.${repo.webhook_id ? '\n\nWebhook also removed from GitHub.' : ''}`,
        keyboard: [[{ text: '📦 Repos', callback_data: 'view:repos' }]],
    };
}
