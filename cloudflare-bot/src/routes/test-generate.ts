import type { Env } from '../types';
import { verifyAdminSecret, secureJsonResponse, logInfo } from '../services/security';

export async function handleTestGenerate(request: Request, url: URL, env: Env): Promise<Response> {
    if (!verifyAdminSecret(request, env)) {
        return secureJsonResponse({ error: 'Unauthorized' }, 401);
    }
    const sha = url.searchParams.get('sha');
    if (!sha) {
        return secureJsonResponse({ error: 'Missing ?sha= parameter' }, 400);
    }

    const { getContentSource } = await import('../services/github');
    const { generateContent, generateImage } = await import('../services/gemini');

    const steps: Record<string, unknown> = {};

    try {
        logInfo('Test: Fetching content source for SHA:', sha);
        const source = await getContentSource(env, sha);
        steps.contentSource = {
            type: source.type,
            commitMessages: source.data.commitMessages,
            fileNames: source.data.fileNames,
            title: source.data.title,
        };

        logInfo('Test: Generating content via Gemini...');
        const result = await generateContent(env, source);
        steps.generatedContent = result.content;
        steps.overviewUpdates = result.overviewUpdates;

        logInfo('Test: Generating image via Gemini...');
        const imageResult = await generateImage(env, result.content);
        steps.imageGenerated = !!imageResult;
        steps.imageMimeType = imageResult?.mimeType;
        steps.imageSize = imageResult?.data.byteLength;

        return secureJsonResponse({ success: true, sha, steps });
    } catch (error) {
        return secureJsonResponse({
            success: false,
            sha,
            error: error instanceof Error ? error.message : String(error),
            steps,
        }, 500);
    }
}
