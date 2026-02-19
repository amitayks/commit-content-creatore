/**
 * Twitter Account Config Toggle Handler
 *
 * Handles tw_config:SETTING:ACCOUNT_ID callbacks for toggling account settings.
 */

import type { HandlerContext } from '../core/router';
import type { ViewResult, TwitterAccountConfig } from '../types';
import { getTwitterAccount, updateTwitterAccount, parseTwitterAccountConfig } from '../services/db';
import { renderAccountDetail } from '../views/accounts';
import { renderError } from '../views';

const TONES: TwitterAccountConfig['tone'][] = ['professional', 'casual', 'analytical', 'enthusiastic', 'witty', 'sarcastic'];
const IMAGE_PROBABILITIES = [0, 0.1, 0.3, 0.5, 0.7, 1.0];
const BATCH_PAGE_SIZES = [3, 5, 8, 10];

export async function accountConfigToggleAction(ctx: HandlerContext & { value: string; extra?: string }): Promise<ViewResult> {
    const setting = ctx.value;
    const accountId = ctx.extra!;

    const account = await getTwitterAccount(ctx.env, accountId, ctx.chatId);
    if (!account) {
        return renderError('Account not found.');
    }

    const config = parseTwitterAccountConfig(account);
    let updated = false;

    switch (setting) {
        case 'language':
            config.language = config.language === 'en' ? 'he' : 'en';
            updated = true;
            break;

        case 'hashtags':
            config.includeHashtags = !config.includeHashtags;
            updated = true;
            break;

        case 'img':
            config.alwaysGenerateImage = !config.alwaysGenerateImage;
            updated = true;
            break;

        case 'img_pct': {
            const currentIdx = IMAGE_PROBABILITIES.indexOf(config.singleImageProbability);
            config.singleImageProbability = IMAGE_PROBABILITIES[(currentIdx + 1) % IMAGE_PROBABILITIES.length];
            updated = true;
            break;
        }

        case 'threshold': {
            config.relevanceThreshold = config.relevanceThreshold >= 10 ? 1 : config.relevanceThreshold + 1;
            updated = true;
            break;
        }

        case 'tone': {
            const currentToneIdx = TONES.indexOf(config.tone);
            config.tone = TONES[(currentToneIdx + 1) % TONES.length];
            updated = true;
            break;
        }

        case 'auto_approve':
            config.autoApprove = !config.autoApprove;
            updated = true;
            break;

        case 'batch_size': {
            const currentBatchIdx = BATCH_PAGE_SIZES.indexOf(config.batchPageSize || 5);
            config.batchPageSize = BATCH_PAGE_SIZES[(currentBatchIdx + 1) % BATCH_PAGE_SIZES.length];
            updated = true;
            break;
        }

        case 'analyze_media':
            config.analyzeMedia = !(config.analyzeMedia !== false);
            updated = true;
            break;
    }

    if (updated) {
        await updateTwitterAccount(ctx.env, accountId, ctx.chatId, { config });
    }

    return renderAccountDetail(ctx.env, ctx.chatId, accountId);
}
