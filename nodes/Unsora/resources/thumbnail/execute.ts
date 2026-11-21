import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationHandlers } from '../../shared/descriptions';
import { createJob, deleteRecord, getRecord, listRecords } from '../../shared/generation';
import { compact } from '../../shared/transport';
import { idempotencyHeaders, toList } from '../../shared/utils';

export const thumbnailOperations: OperationHandlers = {
	async create(itemIndex) {
		const additional = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
		const prompt = this.getNodeParameter('prompt', itemIndex, '') as string;
		const youtubeUrl = String(additional.youtubeUrl ?? '').trim();
		const documentUrl = String(additional.documentUrl ?? '').trim();

		if (youtubeUrl && documentUrl) {
			throw new NodeOperationError(
				this.getNode(),
				'Use either YouTube Video URL or Document URL, not both',
				{ itemIndex },
			);
		}
		const referenceImageUrls = toList(additional.referenceImageUrls);
		if (!prompt.trim() && !youtubeUrl && !documentUrl && referenceImageUrls.length === 0) {
			throw new NodeOperationError(
				this.getNode(),
				'Enter a Prompt, a YouTube Video URL, a Document URL or Reference Image URLs',
				{ itemIndex },
			);
		}

		const context: IDataObject[] = [];
		if (youtubeUrl) context.push({ type: 'youtube', content: youtubeUrl });
		if (documentUrl) context.push({ type: 'document', content: documentUrl });
		const templateImageUrls = toList(additional.templateImageUrl).slice(0, 1);

		const body = compact({
			prompt,
			context: context.length ? context : undefined,
			referenceImageUrls: referenceImageUrls.length ? referenceImageUrls : undefined,
			templateImageUrls: templateImageUrls.length ? templateImageUrls : undefined,
			expression: additional.expression as string | undefined,
			variations: additional.variations as number | undefined,
		});
		return await createJob.call(this, itemIndex, {
			path: '/thumbnails/create',
			body,
			headers: idempotencyHeaders(additional.idempotencyKey),
			statusPath: '/image/status',
			label: 'Thumbnail',
			defaults: { pollIntervalSeconds: 10, timeoutMinutes: 10 },
		});
	},

	async get(itemIndex) {
		return await getRecord.call(this, itemIndex, '/thumbnails', 'thumbnailId');
	},

	async getAll(itemIndex) {
		return await listRecords.call(this, itemIndex, '/thumbnails');
	},

	async delete(itemIndex) {
		return await deleteRecord.call(this, itemIndex, '/thumbnails', 'thumbnailId');
	},
};
