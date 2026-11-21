import type { IDataObject } from 'n8n-workflow';
import type { OperationHandlers } from '../../shared/descriptions';
import { getWaitParameters, waitForJob } from '../../shared/polling';
import { compact, unsoraApiRequest } from '../../shared/transport';
import {
	flattenCreateResponse,
	getManyRecords,
	idempotencyHeaders,
	unwrapData,
	withClipUrls,
} from '../../shared/utils';

const STATUS_PATH = '/clippings/status';

export const clippingOperations: OperationHandlers = {
	async create(itemIndex) {
		const additional = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
		const body = compact({
			videoUrl: (this.getNodeParameter('videoUrl', itemIndex) as string).trim(),
			targetDuration: this.getNodeParameter('targetDuration', itemIndex, 'auto') as string,
			ratio: this.getNodeParameter('ratio', itemIndex, 'original') as string,
			limit: additional.maxClips as number | undefined,
			query: additional.query as string | undefined,
			enableCaption: additional.enableCaption as boolean | undefined,
			captionStyle: additional.captionStyle as string | undefined,
			sourceLang: additional.sourceLang as string | undefined,
			targetLang: additional.targetLang as string | undefined,
		});

		const response = (await unsoraApiRequest.call(this, 'POST', '/clippings/create', {
			body,
			headers: idempotencyHeaders(additional.idempotencyKey),
			itemIndex,
		})) as IDataObject;
		const created = flattenCreateResponse(response);

		const { wait, pollIntervalSeconds, timeoutMinutes } = getWaitParameters.call(this, itemIndex, {
			pollIntervalSeconds: 15,
			timeoutMinutes: 30,
		});
		if (!wait || !created.id) return created;

		const final = await waitForJob.call(this, String(created.id), {
			statusPath: STATUS_PATH,
			label: 'Clipping',
			pollIntervalSeconds,
			timeoutMinutes,
			itemIndex,
		});
		return {
			...withClipUrls(final),
			creditsDeducted: created.creditsDeducted,
			creditsRemaining: created.creditsRemaining,
		};
	},

	async getStatus(itemIndex) {
		const id = this.getNodeParameter('clippingId', itemIndex) as string;
		const response = await unsoraApiRequest.call(
			this,
			'GET',
			`${STATUS_PATH}/${encodeURIComponent(id)}`,
			{ itemIndex },
		);
		return withClipUrls(unwrapData(response));
	},

	async get(itemIndex) {
		const id = this.getNodeParameter('clippingId', itemIndex) as string;
		const response = await unsoraApiRequest.call(
			this,
			'GET',
			`/clippings/${encodeURIComponent(id)}`,
			{
				itemIndex,
			},
		);
		return withClipUrls(unwrapData(response));
	},

	async getAll(itemIndex) {
		const records = await getManyRecords.call(this, '/clippings/all', itemIndex, {
			paginated: false,
		});
		return records.map(withClipUrls);
	},

	async delete(itemIndex) {
		const id = this.getNodeParameter('clippingId', itemIndex) as string;
		const response = await unsoraApiRequest.call(
			this,
			'DELETE',
			`/clippings/${encodeURIComponent(id)}`,
			{ itemIndex },
		);
		return { id, deleted: true, ...unwrapData(response) };
	},

	async deleteClip(itemIndex) {
		const clippingId = this.getNodeParameter('clippingId', itemIndex) as string;
		const clipId = this.getNodeParameter('clipId', itemIndex) as string;
		const response = await unsoraApiRequest.call(
			this,
			'DELETE',
			`/clippings/${encodeURIComponent(clippingId)}/clips/${encodeURIComponent(clipId)}`,
			{ itemIndex },
		);
		return { clippingId, clipId, deleted: true, ...unwrapData(response) };
	},
};
