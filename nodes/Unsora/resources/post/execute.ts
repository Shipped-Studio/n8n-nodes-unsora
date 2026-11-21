import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationHandlers } from '../../shared/descriptions';
import { deleteRecord, getRecord, listRecords } from '../../shared/generation';
import { apiErrorInfo, compact, unsoraApiRequest } from '../../shared/transport';
import {
	idempotencyHeaders,
	parseJsonParameter,
	toIsoDateTime,
	toList,
	unwrapData,
} from '../../shared/utils';

const MAX_ACCOUNTS = 10;

/** Create returns lower-case public values; Get and the trigger use upper-case enums. */
const STATUS_ENUM: Record<string, string> = {
	draft: 'DRAFT',
	scheduled: 'SCHEDULED',
	publishing: 'PUBLISHING',
	published: 'PUBLISHED',
	partially_published: 'PARTIALLY_PUBLISHED',
	failed: 'FAILED',
};
const TYPE_ENUM: Record<string, string> = {
	video: 'VIDEO',
	image: 'IMAGE',
	slideshow: 'CAROUSEL',
	text: 'TEXT',
};

/** Rewrites status and type to the upper-case values Get and Get Many return. */
export function normalizePostSummary(post: IDataObject): IDataObject {
	const result = { ...post };
	if (typeof result.status === 'string') {
		result.status = STATUS_ENUM[result.status.toLowerCase()] ?? result.status.toUpperCase();
	}
	if (typeof result.type === 'string') {
		result.type = TYPE_ENUM[result.type.toLowerCase()] ?? result.type.toUpperCase();
	}
	return result;
}

function camelToSnake(key: string): string {
	return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeKeys(object: IDataObject): IDataObject {
	const result: IDataObject = {};
	for (const [key, value] of Object.entries(object)) result[camelToSnake(key)] = value;
	return result;
}

/** Converts the "Platform Options" fixed collection into the API's `settings` object. */
export function buildPlatformSettings(platformSettings: IDataObject): IDataObject | undefined {
	const settings: IDataObject = {};

	const tiktok = compact(platformSettings.tiktok as IDataObject);
	if (Object.keys(tiktok).length) settings.tiktok = snakeKeys(tiktok);

	const youtube = compact(platformSettings.youtube as IDataObject);
	if (Object.keys(youtube).length) {
		const tags = toList(youtube.tags);
		delete youtube.tags;
		settings.youtube = tags.length ? { ...youtube, tags } : youtube;
	}

	const instagram = compact(platformSettings.instagram as IDataObject);
	if (Object.keys(instagram).length) settings.instagram = snakeKeys(instagram);

	const pinterest = compact(platformSettings.pinterest as IDataObject);
	if (Object.keys(pinterest).length) settings.pinterest = pinterest;

	const googleBusiness = compact(platformSettings.googleBusiness as IDataObject);
	if (Object.keys(googleBusiness).length) settings.google_business = snakeKeys(googleBusiness);

	return Object.keys(settings).length ? settings : undefined;
}

function buildAccounts(
	this: IExecuteFunctions,
	itemIndex: number,
	accountIds: string[],
	overrides: IDataObject[],
): IDataObject[] {
	const accounts = new Map<string, IDataObject>();
	for (const id of accountIds) accounts.set(id, { id });
	for (const override of overrides) {
		const id = String(override.accountId ?? '').trim();
		if (!id) continue;
		const entry = accounts.get(id) ?? { id };
		accounts.set(id, {
			...entry,
			...compact({
				customCaption: override.customCaption as string | undefined,
				title: override.title as string | undefined,
			}),
		});
	}
	if (accounts.size === 0) {
		throw new NodeOperationError(this.getNode(), 'Select at least one account', { itemIndex });
	}
	if (accounts.size > MAX_ACCOUNTS) {
		throw new NodeOperationError(
			this.getNode(),
			`A post can target at most ${MAX_ACCOUNTS} accounts (got ${accounts.size})`,
			{ itemIndex },
		);
	}
	return [...accounts.values()];
}

function buildMedia(
	this: IExecuteFunctions,
	itemIndex: number,
	coverUrl: string | undefined,
): IDataObject | undefined {
	const mediaType = this.getNodeParameter('mediaType', itemIndex, 'video') as string;
	if (mediaType === 'video') {
		const url = (this.getNodeParameter('videoUrl', itemIndex) as string).trim();
		return compact({ type: 'video', url, cover_url: coverUrl });
	}
	if (mediaType === 'images') {
		const urls = toList(this.getNodeParameter('imageUrls', itemIndex));
		if (urls.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Add at least one image URL', { itemIndex });
		}
		return { type: 'slideshow', urls };
	}
	return undefined;
}

export const postOperations: OperationHandlers = {
	async create(itemIndex) {
		const additional = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
		const overrides = this.getNodeParameter(
			'accountOverrides.override',
			itemIndex,
			[],
		) as IDataObject[];
		const platformSettings = this.getNodeParameter(
			'platformSettings',
			itemIndex,
			{},
		) as IDataObject;
		const publishMode = this.getNodeParameter('publishMode', itemIndex, 'schedule') as string;

		const body: IDataObject = {
			caption: this.getNodeParameter('caption', itemIndex) as string,
			accounts: buildAccounts.call(
				this,
				itemIndex,
				toList(this.getNodeParameter('accounts', itemIndex, [])),
				overrides,
			),
		};

		const media = buildMedia.call(this, itemIndex, additional.coverUrl as string | undefined);
		if (media) body.media = media;

		if (publishMode === 'schedule') {
			const scheduledAt = toIsoDateTime(
				this.getNodeParameter('scheduledAt', itemIndex, ''),
				this.getTimezone(),
			);
			if (!scheduledAt) {
				throw new NodeOperationError(this.getNode(), 'Set "Schedule At" to schedule the post', {
					itemIndex,
				});
			}
			body.scheduled_at = scheduledAt;
			body.timezone = (additional.timezone as string) || this.getTimezone();
		} else if (additional.timezone) {
			body.timezone = additional.timezone;
		}

		const settings = buildPlatformSettings(platformSettings);
		if (settings) body.settings = settings;
		if (additional.type) body.type = additional.type;
		if (additional.externalId) body.external_id = additional.externalId;

		Object.assign(
			body,
			parseJsonParameter.call(this, additional.additionalBody, 'Additional Body (JSON)', itemIndex),
		);

		const created = normalizePostSummary(
			unwrapData(
				await unsoraApiRequest.call(this, 'POST', '/posts', {
					body,
					headers: idempotencyHeaders(additional.idempotencyKey),
					itemIndex,
				}),
			),
		);

		if (publishMode !== 'now' || !created.id) return created;

		const postId = String(created.id);
		let published: IDataObject;
		try {
			published = unwrapData(
				await unsoraApiRequest.call(this, 'POST', `/posts/${encodeURIComponent(postId)}/publish`, {
					itemIndex,
				}),
			);
		} catch (error) {
			const { status, code } = apiErrorInfo(error);
			// A retried item (same Idempotency Key or External ID) gets the existing post back;
			// if that post is already publishing or published, the goal is reached.
			if (status === 409 && code === 'POST_PUBLISHING') {
				published = { postId, status: 'PUBLISHING' };
			} else if (status === 400 && code === 'POST_PUBLISHED') {
				published = { postId, status: 'PUBLISHED' };
			} else {
				const original = error as { message?: string; description?: string | null };
				throw new NodeOperationError(
					this.getNode(),
					original.message || 'Publishing the post failed',
					{
						itemIndex,
						description: [
							`The post was created as a draft (ID ${postId}) but could not be published. Fix the problem and use the Publish operation with this ID, or delete the draft.`,
							original.description,
						]
							.filter(Boolean)
							.join(' '),
					},
				);
			}
		}
		const publishStatus =
			typeof published.status === 'string' ? published.status.toUpperCase() : undefined;
		return { ...created, status: publishStatus ?? created.status, publish: published };
	},

	async get(itemIndex) {
		return await getRecord.call(this, itemIndex, '/posts', 'postId');
	},

	async getAll(itemIndex) {
		const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
		return await listRecords.call(this, itemIndex, '/posts', compact(filters));
	},

	async update(itemIndex) {
		const postId = this.getNodeParameter('postId', itemIndex) as string;
		const fields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;
		const body: IDataObject = {};

		if (typeof fields.caption === 'string' && fields.caption.trim()) {
			body.mainCaption = fields.caption;
		}
		if (fields.clearSchedule === true) {
			body.scheduledFor = null;
		} else {
			const scheduledFor = toIsoDateTime(fields.scheduledAt, this.getTimezone());
			if (scheduledFor) {
				body.scheduledFor = scheduledFor;
				body.timezone = (fields.timezone as string) || this.getTimezone();
			}
		}
		if (fields.timezone && body.scheduledFor !== null) body.timezone = fields.timezone;
		const accounts = toList(fields.accounts);
		if (accounts.length) body.accounts = accounts.map((accountId) => ({ accountId }));

		if (Object.keys(body).length === 0) {
			throw new NodeOperationError(this.getNode(), 'Add at least one field to update', {
				itemIndex,
			});
		}

		const response = await unsoraApiRequest.call(
			this,
			'PUT',
			`/posts/${encodeURIComponent(postId)}`,
			{ body, itemIndex },
		);
		return unwrapData(response);
	},

	async publish(itemIndex) {
		const postId = this.getNodeParameter('postId', itemIndex) as string;
		const response = await unsoraApiRequest.call(
			this,
			'POST',
			`/posts/${encodeURIComponent(postId)}/publish`,
			{ itemIndex },
		);
		return unwrapData(response);
	},

	async retry(itemIndex) {
		const postId = this.getNodeParameter('postId', itemIndex) as string;
		const response = await unsoraApiRequest.call(
			this,
			'POST',
			`/posts/${encodeURIComponent(postId)}/retry`,
			{ itemIndex },
		);
		return unwrapData(response);
	},

	async delete(itemIndex) {
		return await deleteRecord.call(this, itemIndex, '/posts', 'postId');
	},

	async getAnalytics(itemIndex) {
		const days = this.getNodeParameter('days', itemIndex, 30) as number;
		const response = await unsoraApiRequest.call(this, 'GET', '/posts/analytics/summary', {
			qs: { days },
			itemIndex,
		});
		return unwrapData(response);
	},
};
