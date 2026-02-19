/**
 * Video Publishing — Twitter chunked media upload and Instagram Reels publishing
 */

import type { Env, VideoDraft } from '../types';
import { generateOAuthHeader } from './x';
import { logInfo, logError } from './security';

// ==================== TWITTER VIDEO PUBLISH ====================

/**
 * Publish a video to Twitter/X via chunked media upload
 * @returns Tweet URL or null on failure
 */
export async function publishVideoToTwitter(
    env: Env,
    videoDraft: VideoDraft
): Promise<string | null> {
    if (!videoDraft.video_url) {
        logError('No video_url on draft for Twitter publish');
        return null;
    }

    try {
        // Read video from R2
        const obj = await env.IMAGES.get(videoDraft.video_url);
        if (!obj) {
            logError('Video not found in R2:', videoDraft.video_url);
            return null;
        }

        const videoData = await obj.arrayBuffer();
        const totalBytes = videoData.byteLength;
        const mediaUploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

        // Step 1: INIT — initialize chunked upload
        const initBodyParams = {
            command: 'INIT',
            total_bytes: String(totalBytes),
            media_type: 'video/mp4',
            media_category: 'tweet_video',
        };
        const initAuth = await generateOAuthHeader(env, 'POST', mediaUploadUrl, initBodyParams);

        const initResponse = await fetch(mediaUploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': initAuth,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(initBodyParams),
        });

        if (!initResponse.ok) {
            logError('Twitter media INIT failed:', await initResponse.text());
            return null;
        }

        const initResult = await initResponse.json() as { media_id_string: string };
        const mediaId = initResult.media_id_string;

        // Step 2: APPEND — upload chunks (5MB each)
        const chunkSize = 5 * 1024 * 1024;
        let segmentIndex = 0;

        for (let offset = 0; offset < totalBytes; offset += chunkSize) {
            const chunk = videoData.slice(offset, Math.min(offset + chunkSize, totalBytes));

            const appendParams = { command: 'APPEND', media_id: mediaId, segment_index: String(segmentIndex) };
            const appendAuth = await generateOAuthHeader(env, 'POST', mediaUploadUrl, appendParams);

            const appendForm = new FormData();
            appendForm.append('command', 'APPEND');
            appendForm.append('media_id', mediaId);
            appendForm.append('segment_index', String(segmentIndex));
            appendForm.append('media_data', new Blob([chunk]));

            const appendResponse = await fetch(mediaUploadUrl, {
                method: 'POST',
                headers: { 'Authorization': appendAuth },
                body: appendForm,
            });

            if (!appendResponse.ok) {
                logError('Twitter media APPEND failed:', await appendResponse.text());
                return null;
            }

            segmentIndex++;
        }

        // Step 3: FINALIZE
        const finalizeParams = { command: 'FINALIZE', media_id: mediaId };
        const finalizeAuth = await generateOAuthHeader(env, 'POST', mediaUploadUrl, finalizeParams);

        const finalizeResponse = await fetch(mediaUploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': finalizeAuth,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(finalizeParams),
        });

        if (!finalizeResponse.ok) {
            logError('Twitter media FINALIZE failed:', await finalizeResponse.text());
            return null;
        }

        const finalResult = await finalizeResponse.json() as {
            media_id_string: string;
            processing_info?: { state: string; check_after_secs?: number };
        };

        // Wait for processing if needed
        if (finalResult.processing_info) {
            let checkCount = 0;
            const maxChecks = 30;
            while (checkCount < maxChecks) {
                const waitMs = (finalResult.processing_info.check_after_secs || 5) * 1000;
                await new Promise(r => setTimeout(r, Math.min(waitMs, 15000)));

                const statusQueryParams = { command: 'STATUS', media_id: mediaId };
                const statusAuth = await generateOAuthHeader(env, 'GET', mediaUploadUrl, statusQueryParams);

                const statusResponse = await fetch(`${mediaUploadUrl}?${new URLSearchParams(statusQueryParams)}`, {
                    method: 'GET',
                    headers: { 'Authorization': statusAuth },
                });

                if (!statusResponse.ok) break;

                const statusResult = await statusResponse.json() as {
                    processing_info?: { state: string; check_after_secs?: number; error?: { message: string } };
                };

                if (!statusResult.processing_info || statusResult.processing_info.state === 'succeeded') break;
                if (statusResult.processing_info.state === 'failed') {
                    logError('Twitter video processing failed:', statusResult.processing_info.error?.message);
                    return null;
                }

                checkCount++;
            }
        }

        // Step 4: Create tweet with media
        const caption = videoDraft.twitter_caption || videoDraft.title || 'New video!';
        const tweetUrl = 'https://api.twitter.com/2/tweets';
        const tweetAuth = await generateOAuthHeader(env, 'POST', tweetUrl, {});

        const tweetResponse = await fetch(tweetUrl, {
            method: 'POST',
            headers: {
                'Authorization': tweetAuth,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: caption.substring(0, 280),
                media: { media_ids: [mediaId] },
            }),
        });

        if (!tweetResponse.ok) {
            logError('Twitter tweet creation failed:', await tweetResponse.text());
            return null;
        }

        const tweetResult = await tweetResponse.json() as { data: { id: string } };
        const tweetId = tweetResult.data.id;
        const url = `https://twitter.com/i/status/${tweetId}`;
        logInfo('Published video to Twitter:', url);
        return url;
    } catch (error) {
        logError('publishVideoToTwitter error:', error instanceof Error ? error.message : String(error));
        return null;
    }
}

// ==================== INSTAGRAM REELS PUBLISH ====================

/**
 * Publish a video to Instagram Reels via Meta Content Publishing API
 * @returns Instagram URL or null on failure
 */
export async function publishVideoToInstagram(
    env: Env,
    videoDraft: VideoDraft
): Promise<string | null> {
    if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
        logError('Instagram not configured');
        return null;
    }

    if (!videoDraft.video_url) {
        logError('No video_url for Instagram publish');
        return null;
    }

    try {
        // Build public video URL for Meta to fetch
        const videoPublicUrl = `${env.WORKER_URL}/media/${videoDraft.video_url}`;

        // Step 1: Create media container
        const containerUrl = `https://graph.facebook.com/v19.0/${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`;
        const containerResponse = await fetch(containerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                video_url: videoPublicUrl,
                caption: (videoDraft.caption || '').substring(0, 2200),
                media_type: 'REELS',
                access_token: env.INSTAGRAM_ACCESS_TOKEN,
            }),
        });

        if (!containerResponse.ok) {
            logError('Instagram container creation failed:', await containerResponse.text());
            return null;
        }

        const containerResult = await containerResponse.json() as { id: string };
        const containerId = containerResult.id;

        // Step 2: Poll for processing completion (max 5 minutes)
        const maxWait = 5 * 60 * 1000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
            await new Promise(r => setTimeout(r, 10000)); // Check every 10s

            const statusUrl = `https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`;
            const statusResponse = await fetch(statusUrl);
            const statusResult = await statusResponse.json() as { status_code: string };

            if (statusResult.status_code === 'FINISHED') break;
            if (statusResult.status_code === 'ERROR') {
                logError('Instagram container processing failed');
                return null;
            }
        }

        // Step 3: Publish
        const publishUrl = `https://graph.facebook.com/v19.0/${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`;
        const publishResponse = await fetch(publishUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creation_id: containerId,
                access_token: env.INSTAGRAM_ACCESS_TOKEN,
            }),
        });

        if (!publishResponse.ok) {
            logError('Instagram publish failed:', await publishResponse.text());
            return null;
        }

        const publishResult = await publishResponse.json() as { id: string };
        const igUrl = `https://www.instagram.com/reel/${publishResult.id}`;
        logInfo('Published video to Instagram:', igUrl);
        return igUrl;
    } catch (error) {
        logError('publishVideoToInstagram error:', error instanceof Error ? error.message : String(error));
        return null;
    }
}
