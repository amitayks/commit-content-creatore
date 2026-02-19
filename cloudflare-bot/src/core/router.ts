/**
 * Router — dispatch tables for commands, actions, and input handlers
 */

import type { Env, ViewResult, ChatContext } from '../types';

// ==================== TYPES ====================

export interface HandlerContext {
    env: Env;
    chatId: string;
    messageId?: number;
    args?: string;
    executionCtx?: ExecutionContext;
}

export type CommandHandler = (ctx: HandlerContext) => Promise<ViewResult | void>;

export type ActionHandler = (
    ctx: HandlerContext & { value: string; extra?: string }
) => Promise<ViewResult | void>;

export type InputHandler = (
    ctx: HandlerContext & { text: string; context: ChatContext }
) => Promise<ViewResult | void>;

// ==================== COMMAND DISPATCH ====================

import { startCommand } from '../commands/start';
import { generateCommand } from '../commands/generate';
import { approveCommand } from '../commands/approve';
import { draftsCommand } from '../commands/drafts';
import { helpCommand } from '../commands/help';
import { scheduleCommand } from '../commands/schedule';
import { deleteCommand } from '../commands/delete';
import { reposCommand } from '../commands/repos';
import { watchCommand } from '../commands/watch';
import { handwriteCommand } from '../commands/handwrite';
import { overviewCommand } from '../commands/overview';
import { repostCommand } from '../commands/repost';

export const commandHandlers: Record<string, CommandHandler> = {
    '/start': startCommand,
    '/generate': generateCommand,
    '/approve': approveCommand,
    '/drafts': draftsCommand,
    '/help': helpCommand,
    '/schedule': scheduleCommand,
    '/delete': deleteCommand,
    '/repos': reposCommand,
    '/watch': watchCommand,
    '/handwrite': handwriteCommand,
    '/overview': overviewCommand,
    '/repost': repostCommand,
};

// ==================== ACTION DISPATCH ====================

import { viewChangeAction } from '../actions/view-change';
import { draftDetailAction } from '../actions/draft-detail';
import { approveAction } from '../actions/approve';
import { publishAction } from '../actions/publish';
import { publishAllAction } from '../actions/publish-all';
import { scheduleAction } from '../actions/schedule';
import { unscheduleAction } from '../actions/unschedule';
import { editAction } from '../actions/edit';
import { addRepoAction, watchAction, unwatchAction, deleteRepoAction, confirmDeleteRepoAction } from '../actions/repo-actions';
import { configToggleAction } from '../actions/config-toggle';
import { accountDetailAction, addAccountAction, followAction, unfollowAction, deleteAccountAction, confirmDeleteAccountAction, bootstrapAction } from '../actions/account-actions';
import { accountConfigToggleAction } from '../actions/account-config';
import { tweetGenerateAction } from '../actions/tweet-generate';
import { schedDayAction } from '../actions/schedule-day';
import { composeAction } from '../actions/compose';
import { deleteDraftAction, confirmDeleteDraftAction, cancelDeleteDraftAction } from '../actions/delete-draft';
import { listApproveAction, listPublishAction, listDeleteAction, listConfirmDeleteAction, listCancelDeleteAction } from '../actions/list-actions';
import { paginationAction } from '../actions/pagination';
import { videoConfigAction, videoCreateAction, videoGenerateAction, videoApproveAction, videoRegenAction, videoDeleteAction, videoPublishAction, videoScheduleAction, videoPubTwitterAction, videoPubInstagramAction, videoPubBothAction, videoPubNaAction } from '../actions/video-actions';
import { videoSettingsAction } from '../actions/video-settings';
import { batchPageAction } from '../actions/batch-page';
import { tweetViewDraftAction } from '../actions/tweet-view-draft';
import { rpToneAction, rpGenAction, rpCancelAction } from '../actions/repost-preview';
import { rpFollowAction, rpNoFollowAction } from '../actions/repost-follow';
import { settingsKeysAction } from '../actions/settings-keys';

/** Action handlers keyed by the `action` part of `action:ACTION:ID` */
const actionSubHandlers: Record<string, ActionHandler> = {
    approve: approveAction,
    publish: publishAction,
    publish_approved: publishAllAction,
    schedule: scheduleAction,
    unschedule: unscheduleAction,
    edit: editAction,
    add_repo: addRepoAction as ActionHandler,
    watch: watchAction as ActionHandler,
    unwatch: unwatchAction as ActionHandler,
    delete_repo: deleteRepoAction as ActionHandler,
    confirm_delete_repo: confirmDeleteRepoAction as ActionHandler,
    delete_draft: deleteDraftAction,
    confirm_delete: confirmDeleteDraftAction,
    cancel_delete: cancelDeleteDraftAction,
    la: listApproveAction,
    lp: listPublishAction,
    ld: listDeleteAction,
    lyd: listConfirmDeleteAction,
    lnd: listCancelDeleteAction,
    // Twitter account actions
    add_account: addAccountAction as ActionHandler,
    tw_gen: tweetGenerateAction as ActionHandler,
    tw_follow: followAction as ActionHandler,
    tw_unfollow: unfollowAction as ActionHandler,
    tw_delete: deleteAccountAction as ActionHandler,
    tw_delete_yes: confirmDeleteAccountAction as ActionHandler,
    tw_bootstrap: bootstrapAction as ActionHandler,
    sched_day: schedDayAction as ActionHandler,
    // Video actions
    video_create: videoCreateAction,
    video_generate: videoGenerateAction,
    video_approve_script: videoApproveAction,
    video_regen_script: videoRegenAction,
    video_delete: videoDeleteAction,
    video_publish: videoPublishAction,
    video_pub_twitter: videoPubTwitterAction,
    video_pub_instagram: videoPubInstagramAction,
    video_pub_both: videoPubBothAction,
    video_pub_na: videoPubNaAction,
    video_schedule: videoScheduleAction,
};

/**
 * Top-level callback dispatch by prefix.
 * Callback data format: `prefix:value` or `prefix:value:extra`
 */
export const callbackHandlers: Record<string, ActionHandler> = {
    view: viewChangeAction,
    draft: draftDetailAction as ActionHandler,
    action: async (ctx) => {
        const handler = actionSubHandlers[ctx.value];
        if (handler) {
            return handler(ctx);
        }
        const { renderHome } = await import('../views');
        return renderHome(ctx.env, ctx.chatId);
    },
    page: paginationAction,
    repo: async (ctx) => {
        // View repo detail — reuse the same pattern as draft detail
        const { updateChatState } = await import('../services/db');
        const { renderRepoDetail } = await import('../views');
        await updateChatState(ctx.env, ctx.chatId, {
            current_view: 'repo',
            context: { selected_repo_id: ctx.value },
        });
        return renderRepoDetail(ctx.env, ctx.chatId, ctx.value);
    },
    config: configToggleAction,
    account: accountDetailAction as ActionHandler,
    tw_config: accountConfigToggleAction,
    compose: composeAction,
    tw_batch: batchPageAction,
    tw_view: tweetViewDraftAction,
    vconfig: videoConfigAction,
    vsettings: videoSettingsAction,
    vs: videoSettingsAction,
    // Settings key management
    settings: settingsKeysAction,
    // Repost actions
    rp_tone: rpToneAction,
    rp_gen: rpGenAction,
    rp_gen_anyway: rpGenAction,
    rp_cancel: rpCancelAction,
    rp_follow: rpFollowAction,
    rp_no_follow: rpNoFollowAction,
};

// ==================== INPUT DISPATCH ====================

import { commitShaInput } from '../inputs/commit-sha';
import { scheduleInput } from '../inputs/schedule';
import { deleteInput } from '../inputs/delete';
import { addRepoInput } from '../inputs/add-repo';
import { editDraftInput } from '../inputs/edit-draft';
import { handwriteInput } from '../inputs/handwrite';
import { timezoneInput } from '../inputs/timezone';
import { editOverviewInput } from '../inputs/edit-overview';
import { videoPresetNameInput } from '../inputs/video-preset';
import { editCharacterInput } from '../inputs/edit-character';
import { addTwitterAccountInput } from '../inputs/add-twitter-account';
import { scheduleTimeInput } from '../inputs/schedule-time';
import { repostUrlInput } from '../inputs/repost-url';
import { settingsKeyInput } from '../inputs/settings-key';

export const inputHandlers: Record<string, InputHandler> = {
    commit_sha: commitShaInput,
    schedule: scheduleInput,
    delete: deleteInput,
    add_repo: addRepoInput,
    edit_draft: editDraftInput,
    handwrite: handwriteInput as InputHandler,
    timezone: timezoneInput,
    edit_overview: editOverviewInput,
    video_preset_name: videoPresetNameInput,
    edit_character: editCharacterInput as InputHandler,
    add_account: addTwitterAccountInput,
    schedule_time: scheduleTimeInput,
    repost_url: repostUrlInput,
    update_key: settingsKeyInput,
};
