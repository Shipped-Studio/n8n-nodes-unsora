import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Unsora } from '../nodes/Unsora/Unsora.node';
import { BASE_URL, createExecuteContext } from './helpers';

vi.mock('n8n-workflow', async (importOriginal) => ({
	...(await importOriginal<typeof import('n8n-workflow')>()),
	sleep: vi.fn(async () => {}),
}));

const node = new Unsora();

beforeEach(() => {
	vi.mocked(sleep).mockClear();
});

describe('Clipping', () => {
	it('creates a clipping and waits until it completes', async () => {
		const { context, requests } = createExecuteContext({
			params: {
				resource: 'clipping',
				operation: 'create',
				videoUrl: ' https://youtube.com/watch?v=abc ',
				targetDuration: '30-60',
				ratio: '9:16',
				additionalFields: {
					maxClips: 5,
					enableCaption: true,
					captionStyle: 'bold-white',
					query: '',
				},
				waitForCompletion: true,
				pollInterval: 1,
				timeout: 30,
			},
			responses: [
				{
					statusCode: 201,
					body: {
						success: true,
						data: { id: 'clip_1', status: 'QUEUED' },
						creditsDeducted: 10,
						creditsRemaining: 90,
					},
				},
				{ body: { success: true, data: { id: 'clip_1', status: 'PROCESSING', clips: [] } } },
				{
					body: {
						success: true,
						data: {
							id: 'clip_1',
							status: 'COMPLETED',
							clips: [{ id: 'c1', url: 'https://cdn/c1.mp4' }],
						},
					},
				},
			],
		});

		const [output] = await node.execute.call(context);

		expect(requests[0]).toMatchObject({
			method: 'POST',
			url: `${BASE_URL}/clippings/create`,
			body: {
				videoUrl: 'https://youtube.com/watch?v=abc',
				targetDuration: '30-60',
				ratio: '9:16',
				limit: 5,
				enableCaption: true,
				captionStyle: 'bold-white',
			},
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		});
		expect(requests[0].body).not.toHaveProperty('query');
		expect(requests.slice(1).map((r) => r.url)).toEqual([
			`${BASE_URL}/clippings/status/clip_1`,
			`${BASE_URL}/clippings/status/clip_1`,
		]);
		// Poll interval is clamped to the 5 second minimum.
		expect(sleep).toHaveBeenCalledWith(5000);
		expect(output).toEqual([
			{
				json: {
					id: 'clip_1',
					status: 'COMPLETED',
					clips: [{ id: 'c1', url: 'https://cdn/c1.mp4', clipUrl: 'https://cdn/c1.mp4' }],
					creditsDeducted: 10,
					creditsRemaining: 90,
				},
				pairedItem: { item: 0 },
			},
		]);
	});

	it('returns the queued job right away when not waiting', async () => {
		const { context, requests } = createExecuteContext({
			params: {
				resource: 'clipping',
				operation: 'create',
				videoUrl: 'https://youtube.com/watch?v=abc',
				additionalFields: { idempotencyKey: 'run-42' },
				waitForCompletion: false,
			},
			responses: [{ body: { success: true, data: { id: 'clip_2', status: 'QUEUED' } } }],
		});
		const [output] = await node.execute.call(context);
		expect(requests).toHaveLength(1);
		expect(requests[0].headers).toMatchObject({ 'Idempotency-Key': 'run-42' });
		expect(output[0].json).toEqual({ id: 'clip_2', status: 'QUEUED' });
	});

	it('throws when the job fails', async () => {
		const { context } = createExecuteContext({
			params: {
				resource: 'clipping',
				operation: 'create',
				videoUrl: 'https://youtube.com/watch?v=abc',
				additionalFields: {},
				waitForCompletion: true,
				pollInterval: 15,
				timeout: 30,
			},
			responses: [
				{ body: { data: { id: 'clip_3', status: 'QUEUED' } } },
				{ body: { data: { id: 'clip_3', status: 'FAILED', error: 'Video is private' } } },
			],
		});
		await expect(node.execute.call(context)).rejects.toThrow('Clipping failed: Video is private');
	});

	it('times out with a helpful message', async () => {
		const { context } = createExecuteContext({
			params: {
				resource: 'clipping',
				operation: 'create',
				videoUrl: 'https://youtube.com/watch?v=abc',
				additionalFields: {},
				waitForCompletion: true,
				pollInterval: 15,
				timeout: 0,
			},
			responses: [
				{ body: { data: { id: 'clip_4', status: 'QUEUED' } } },
				{ body: { data: { id: 'clip_4', status: 'PROCESSING' } } },
			],
		});
		const error = await node.execute.call(context).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as Error).message).toContain('clip_4 is still PROCESSING');
	});

	it('outputs the error and continues when "Continue On Fail" is on', async () => {
		const { context } = createExecuteContext({
			params: { resource: 'clipping', operation: 'get', clippingId: 'missing' },
			responses: [{ statusCode: 404, body: { success: false, error: 'Clipping not found' } }],
			continueOnFail: true,
		});
		const [output] = await node.execute.call(context);
		expect(output).toEqual([
			{ json: { error: 'Unsora API error 404: Clipping not found' }, pairedItem: { item: 0 } },
		]);
	});
});

describe('API errors', () => {
	it('surfaces the API error text, status and code', async () => {
		const { context } = createExecuteContext({
			params: {
				resource: 'video',
				operation: 'create',
				prompt: 'a cat',
				model: 'seedance-2.0',
				additionalFields: {},
				waitForCompletion: false,
			},
			responses: [
				{
					statusCode: 402,
					body: { success: false, error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' },
				},
			],
		});
		const error = (await node.execute.call(context).catch((e: unknown) => e)) as NodeApiError;
		expect(error).toBeInstanceOf(NodeApiError);
		expect(error.message).toBe('Unsora API error 402 (INSUFFICIENT_CREDITS): Insufficient credits');
		expect(error.httpCode).toBe('402');
		expect(error.description).toContain('credits');
	});

	it('retries a 429 with a fixed backoff when Retry-After is missing', async () => {
		const { context, requests } = createExecuteContext({
			params: { resource: 'user', operation: 'getCredits' },
			responses: [
				{ statusCode: 429, body: { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' } },
				{ body: { credits: 120 } },
			],
		});
		const [output] = await node.execute.call(context);
		expect(requests).toHaveLength(2);
		expect(sleep).toHaveBeenCalledWith(15_000);
		expect(output[0].json).toEqual({ credits: 120 });
	});

	it('gives up after the retry budget and reports the rate limit', async () => {
		const { context, requests } = createExecuteContext({
			params: { resource: 'user', operation: 'getCredits' },
			responses: [
				{ statusCode: 429, body: { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' } },
			],
		});
		await expect(node.execute.call(context)).rejects.toThrow(
			'Unsora API error 429 (RATE_LIMIT_EXCEEDED): Too many requests',
		);
		expect(requests).toHaveLength(3);
	});
});

describe('Generations', () => {
	it('creates a video with optional fields and waits for the output URL', async () => {
		const { context, requests } = createExecuteContext({
			params: {
				resource: 'video',
				operation: 'create',
				prompt: 'drone shot over mountains',
				model: 'veo-3.1-fast',
				additionalFields: {
					duration: 8,
					aspectRatio: '9:16',
					sound: true,
					referenceImages: 'https://a.png, https://b.png',
				},
				waitForCompletion: true,
				pollInterval: 10,
				timeout: 10,
			},
			responses: [
				{
					body: {
						success: true,
						generation: { id: 'v1', status: 'QUEUED' },
						model: 'veo-3.1-fast',
					},
				},
				{
					body: {
						success: true,
						data: { id: 'v1', status: 'COMPLETED', outputUrl: 'https://cdn/v1.mp4' },
					},
				},
			],
		});
		const [output] = await node.execute.call(context);
		expect(requests[0].body).toEqual({
			prompt: 'drone shot over mountains',
			model: 'veo-3.1-fast',
			duration: 8,
			aspectRatio: '9:16',
			sound: true,
			referenceImages: ['https://a.png', 'https://b.png'],
		});
		expect(requests[1].url).toBe(`${BASE_URL}/video/status/v1`);
		expect(output[0].json).toMatchObject({
			id: 'v1',
			status: 'COMPLETED',
			outputUrl: 'https://cdn/v1.mp4',
		});
	});

	it('waits for every thumbnail variation and returns one item each', async () => {
		const { context, requests } = createExecuteContext({
			params: {
				resource: 'thumbnail',
				operation: 'create',
				prompt: 'I quit my job',
				additionalFields: { youtubeUrl: 'https://youtu.be/x', variations: 2 },
				waitForCompletion: true,
				pollInterval: 10,
				timeout: 10,
			},
			responses: [
				{
					body: {
						success: true,
						generations: [
							{ id: 't1', status: 'QUEUED' },
							{ id: 't2', status: 'QUEUED' },
						],
					},
				},
				(request) => ({
					body: { data: { id: String(request.url).split('/').pop(), status: 'COMPLETED' } },
				}),
			],
		});
		const [output] = await node.execute.call(context);
		expect(requests[0].body).toEqual({
			prompt: 'I quit my job',
			context: [{ type: 'youtube', content: 'https://youtu.be/x' }],
			variations: 2,
		});
		expect(requests.slice(1).map((r) => r.url)).toEqual([
			`${BASE_URL}/image/status/t1`,
			`${BASE_URL}/image/status/t2`,
		]);
		expect(output.map((item) => item.json.id)).toEqual(['t1', 't2']);
		expect(
			output.every((item) => item.pairedItem && (item.pairedItem as { item: number }).item === 0),
		).toBe(true);
	});

	it('rejects a thumbnail with both a YouTube and a document source', async () => {
		const { context } = createExecuteContext({
			params: {
				resource: 'thumbnail',
				operation: 'create',
				prompt: '',
				additionalFields: { youtubeUrl: 'https://youtu.be/x', documentUrl: 'https://x.pdf' },
				waitForCompletion: false,
			},
			responses: [{ body: {} }],
		});
		await expect(node.execute.call(context)).rejects.toThrow('not both');
	});

	it('sends voiceover fields with API names', async () => {
		const { context, requests } = createExecuteContext({
			params: {
				resource: 'voiceover',
				operation: 'create',
				text: 'Hello there',
				voiceId: 'Aria',
				additionalFields: { stability: 0.3 },
				waitForCompletion: false,
			},
			responses: [
				{
					body: {
						success: true,
						generation: { id: 'vo1', status: 'QUEUED' },
						creditsDeducted: 1,
						creditsRemaining: 5,
					},
				},
			],
		});
		const [output] = await node.execute.call(context);
		expect(requests[0].body).toEqual({ text: 'Hello there', voice_id: 'Aria', stability: 0.3 });
		expect(output[0].json).toEqual({
			id: 'vo1',
			status: 'QUEUED',
			creditsDeducted: 1,
			creditsRemaining: 5,
		});
	});
});

describe('Post', () => {
	it('builds a scheduled video post with overrides and platform options', async () => {
		const { context, requests } = createExecuteContext({
			timezone: 'Europe/Berlin',
			params: {
				resource: 'post',
				operation: 'create',
				accounts: ['acc_tt', 'acc_yt'],
				caption: 'New clip!',
				mediaType: 'video',
				videoUrl: 'https://cdn/c1.mp4',
				publishMode: 'schedule',
				scheduledAt: '2026-12-01T18:00:00',
				accountOverrides: {
					override: [{ accountId: 'acc_yt', title: 'My Short', customCaption: '' }],
				},
				platformSettings: {
					tiktok: { privacyLevel: 'SELF_ONLY', disableDuet: true, isAigc: false },
					youtube: {
						privacyStatus: 'unlisted',
						tags: 'ai, clips',
						categoryId: '22',
						madeForKids: false,
					},
				},
				additionalFields: { externalId: 'row-7', additionalBody: '{"type":"VIDEO"}' },
			},
			responses: [
				{
					statusCode: 201,
					body: {
						success: true,
						message: 'Post scheduled',
						data: { id: 'p1', status: 'scheduled' },
					},
				},
			],
		});
		const [output] = await node.execute.call(context);
		expect(requests[0]).toMatchObject({ method: 'POST', url: `${BASE_URL}/posts` });
		expect(requests[0].body).toEqual({
			caption: 'New clip!',
			accounts: [{ id: 'acc_tt' }, { id: 'acc_yt', title: 'My Short' }],
			media: { type: 'video', url: 'https://cdn/c1.mp4' },
			scheduled_at: '2026-12-01T17:00:00.000Z',
			timezone: 'Europe/Berlin',
			settings: {
				tiktok: { privacy_level: 'SELF_ONLY', disable_duet: true, is_aigc: false },
				youtube: {
					privacyStatus: 'unlisted',
					categoryId: '22',
					madeForKids: false,
					tags: ['ai', 'clips'],
				},
			},
			external_id: 'row-7',
			type: 'VIDEO',
		});
		expect(output[0].json).toEqual({ id: 'p1', status: 'SCHEDULED' });
	});

	it('creates a carousel and publishes it immediately', async () => {
		const { context, requests } = createExecuteContext({
			params: {
				resource: 'post',
				operation: 'create',
				accounts: 'acc_ig',
				caption: 'Swipe',
				mediaType: 'images',
				imageUrls: 'https://a.jpg\nhttps://b.jpg',
				publishMode: 'now',
				accountOverrides: {},
				platformSettings: {},
				additionalFields: {},
			},
			responses: [
				{ body: { success: true, data: { id: 'p2', status: 'draft' } } },
				{
					statusCode: 202,
					body: { success: true, data: { postId: 'p2', status: 'PUBLISHING', results: [] } },
				},
			],
		});
		const [output] = await node.execute.call(context);
		expect(requests[0].body).toEqual({
			caption: 'Swipe',
			accounts: [{ id: 'acc_ig' }],
			media: { type: 'slideshow', urls: ['https://a.jpg', 'https://b.jpg'] },
		});
		expect(requests[1]).toMatchObject({ method: 'POST', url: `${BASE_URL}/posts/p2/publish` });
		expect(output[0].json).toMatchObject({ id: 'p2', status: 'PUBLISHING' });
	});

	it('treats an already publishing post as published now on a retried item', async () => {
		const { context } = createExecuteContext({
			params: {
				resource: 'post',
				operation: 'create',
				accounts: 'acc_ig',
				caption: 'Again',
				mediaType: 'none',
				publishMode: 'now',
				accountOverrides: {},
				platformSettings: {},
				additionalFields: { idempotencyKey: 'row-7' },
			},
			responses: [
				{ body: { success: true, data: { id: 'p5', status: 'draft', type: 'text' } } },
				{
					statusCode: 409,
					body: { success: false, error: 'Post is already publishing', code: 'POST_PUBLISHING' },
				},
			],
		});
		const [output] = await node.execute.call(context);
		expect(output[0].json).toMatchObject({ id: 'p5', status: 'PUBLISHING', type: 'TEXT' });
	});

	it('names the draft post when publishing fails', async () => {
		const { context } = createExecuteContext({
			params: {
				resource: 'post',
				operation: 'create',
				accounts: 'acc_gb',
				caption: 'No media',
				mediaType: 'none',
				publishMode: 'now',
				accountOverrides: {},
				platformSettings: {},
				additionalFields: {},
			},
			responses: [
				{ body: { success: true, data: { id: 'p6', status: 'draft' } } },
				{
					statusCode: 400,
					body: { success: false, error: 'Media is required', code: 'MEDIA_REQUIRED' },
				},
			],
		});
		const error = await node.execute.call(context).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain('Media is required');
		expect((error as NodeOperationError).description).toContain('draft (ID p6)');
	});

	it('updates a post schedule and accounts', async () => {
		const { context, requests } = createExecuteContext({
			params: {
				resource: 'post',
				operation: 'update',
				postId: 'p3',
				updateFields: {
					caption: 'Edited',
					scheduledAt: '2026-12-24T08:00:00Z',
					accounts: ['a1', 'a2'],
				},
			},
			responses: [{ body: { success: true, data: { id: 'p3' } } }],
		});
		await node.execute.call(context);
		expect(requests[0]).toMatchObject({ method: 'PUT', url: `${BASE_URL}/posts/p3` });
		expect(requests[0].body).toEqual({
			mainCaption: 'Edited',
			scheduledFor: '2026-12-24T08:00:00.000Z',
			timezone: 'UTC',
			accounts: [{ accountId: 'a1' }, { accountId: 'a2' }],
		});
	});

	it('pages through posts when Return All is on', async () => {
		const { context, requests } = createExecuteContext({
			params: {
				resource: 'post',
				operation: 'getAll',
				returnAll: true,
				filters: { status: 'PUBLISHED' },
			},
			responses: [
				{
					body: { data: { posts: [{ id: 1 }, { id: 2 }], pagination: { page: 1, totalPages: 2 } } },
				},
				{ body: { data: { posts: [{ id: 3 }], pagination: { page: 2, totalPages: 2 } } } },
			],
		});
		const [output] = await node.execute.call(context);
		expect(requests.map((r) => r.qs)).toEqual([
			{ status: 'PUBLISHED', page: 1, limit: 100 },
			{ status: 'PUBLISHED', page: 2, limit: 100 },
		]);
		expect(output.map((item) => item.json.id)).toEqual([1, 2, 3]);
	});

	it('respects the limit for non-paginated lists', async () => {
		const { context } = createExecuteContext({
			params: { resource: 'clipping', operation: 'getAll', returnAll: false, limit: 2 },
			responses: [{ body: { success: true, data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } }],
		});
		const [output] = await node.execute.call(context);
		expect(output.map((item) => item.json.id)).toEqual(['a', 'b']);
	});
});

describe('Upload', () => {
	it('uploads a binary file as base64', async () => {
		const { context, requests } = createExecuteContext({
			params: {
				resource: 'upload',
				operation: 'uploadFile',
				binaryPropertyName: 'data',
				options: {},
			},
			binary: {
				data: {
					data: { data: '', mimeType: 'video/mp4', fileName: 'clip.mp4' },
					buffer: Buffer.from('hello'),
				},
			},
			responses: [{ body: { success: true, data: { id: 'u1', url: 'https://cdn/clip.mp4' } } }],
		});
		const [output] = await node.execute.call(context);
		expect(requests[0].body).toEqual({
			base64: Buffer.from('hello').toString('base64'),
			fileName: 'clip.mp4',
			contentType: 'video/mp4',
		});
		expect(output[0].json).toEqual({ id: 'u1', url: 'https://cdn/clip.mp4' });
	});

	it('sends files over 5 MB through a signed upload URL', async () => {
		const big = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
		const { context, requests, plainRequests } = createExecuteContext({
			params: {
				resource: 'upload',
				operation: 'uploadFile',
				binaryPropertyName: 'data',
				options: {},
			},
			binary: {
				data: { data: { data: '', mimeType: 'video/mp4', fileName: 'long.mp4' }, buffer: big },
			},
			plainResponder: () => ({}),
			responses: [
				{
					body: {
						success: true,
						data: { uploadUrl: 'https://storage.test/put?token=x', blobName: 'uploads/u/long.mp4' },
					},
				},
				{ body: { success: true, data: { id: 'u2', url: 'https://cdn/long.mp4' } } },
			],
		});
		const [output] = await node.execute.call(context);
		expect(requests[0]).toMatchObject({ method: 'POST', url: `${BASE_URL}/uploads/signed-url` });
		expect(requests[0].body).toEqual({ fileName: 'long.mp4' });
		expect(plainRequests).toHaveLength(1);
		expect(plainRequests[0]).toMatchObject({
			method: 'PUT',
			url: 'https://storage.test/put?token=x',
			headers: { 'Content-Type': 'video/mp4' },
		});
		expect(plainRequests[0].body).toBe(big);
		expect(requests[1]).toMatchObject({ method: 'POST', url: `${BASE_URL}/uploads/complete` });
		expect(requests[1].body).toEqual({ blobName: 'uploads/u/long.mp4', fileName: 'long.mp4' });
		expect(output[0].json).toEqual({ id: 'u2', url: 'https://cdn/long.mp4' });
	});
});

describe('Fixes from the API audit', () => {
	it('unwraps `generation` on Image › Get', async () => {
		const { context } = createExecuteContext({
			params: { resource: 'image', operation: 'get', imageId: 'img1' },
			responses: [
				{
					body: {
						success: true,
						generation: {
							id: 'img1',
							status: 'COMPLETED',
							outputAsset: { url: 'https://cdn/i.png' },
						},
					},
				},
			],
		});
		const [output] = await node.execute.call(context);
		expect(output[0].json).toMatchObject({ id: 'img1', outputAsset: { url: 'https://cdn/i.png' } });
	});

	it('pages through thumbnails', async () => {
		const { context, requests } = createExecuteContext({
			params: { resource: 'thumbnail', operation: 'getAll', returnAll: false, limit: 30 },
			responses: [
				{ body: { success: true, data: [{ id: 't1' }], pagination: { page: 1, totalPages: 1 } } },
			],
		});
		await node.execute.call(context);
		expect(requests[0].url).toBe(`${BASE_URL}/thumbnails`);
		expect(requests[0].qs).toEqual({ page: 1, limit: 30 });
	});

	it('accepts a thumbnail with only reference images', async () => {
		const { context, requests } = createExecuteContext({
			params: {
				resource: 'thumbnail',
				operation: 'create',
				prompt: '',
				additionalFields: { referenceImageUrls: 'https://me.jpg' },
				waitForCompletion: false,
			},
			responses: [{ body: { success: true, generations: [{ id: 't9', status: 'QUEUED' }] } }],
		});
		await node.execute.call(context);
		expect(requests[0].body).toEqual({ referenceImageUrls: ['https://me.jpg'] });
	});

	it('requires lyrics for song models', async () => {
		const { context, requests } = createExecuteContext({
			params: {
				resource: 'music',
				operation: 'create',
				prompt: 'lofi beats',
				lyrics: '',
				additionalFields: {},
				waitForCompletion: false,
			},
			responses: [{ body: {} }],
		});
		await expect(node.execute.call(context)).rejects.toThrow('Lyrics are required');
		expect(requests).toHaveLength(0);
	});

	it('makes an instrumental with only a style prompt', async () => {
		const { context, requests } = createExecuteContext({
			params: {
				resource: 'music',
				operation: 'create',
				prompt: 'lofi beats',
				lyrics: 'ignored',
				additionalFields: { model: 'mureka-7.5' },
				waitForCompletion: false,
			},
			responses: [{ body: { success: true, generation: { id: 'm1', status: 'QUEUED' } } }],
		});
		await node.execute.call(context);
		expect(requests[0].body).toEqual({ prompt: 'lofi beats', model: 'mureka-7.5' });
	});
});
