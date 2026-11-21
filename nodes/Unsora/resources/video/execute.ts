import type { IDataObject } from 'n8n-workflow';
import type { OperationHandlers } from '../../shared/descriptions';
import { createJob, deleteRecord, getJobStatus, listRecords } from '../../shared/generation';
import { compact } from '../../shared/transport';
import { idempotencyHeaders, toList } from '../../shared/utils';

const STATUS_PATH = '/video/status';

export const videoOperations: OperationHandlers = {
	async create(itemIndex) {
		const additional = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
		const referenceImages = toList(additional.referenceImages);
		const body = compact({
			prompt: this.getNodeParameter('prompt', itemIndex) as string,
			model: this.getNodeParameter('model', itemIndex, 'seedance-2.0') as string,
			duration: additional.duration as number | undefined,
			aspectRatio: additional.aspectRatio as string | undefined,
			resolution: additional.resolution as string | undefined,
			sound: additional.sound as boolean | undefined,
			image: additional.image as string | undefined,
			lastImage: additional.lastImage as string | undefined,
			negativePrompt: additional.negativePrompt as string | undefined,
			referenceImages: referenceImages.length ? referenceImages : undefined,
		});
		return await createJob.call(this, itemIndex, {
			path: '/videos/create',
			body,
			headers: idempotencyHeaders(additional.idempotencyKey),
			statusPath: STATUS_PATH,
			label: 'Video',
			defaults: { pollIntervalSeconds: 10, timeoutMinutes: 10 },
		});
	},

	async getStatus(itemIndex) {
		return await getJobStatus.call(this, itemIndex, STATUS_PATH, 'videoId');
	},

	async getAll(itemIndex) {
		const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
		return await listRecords.call(this, itemIndex, '/videos/all', compact(filters));
	},

	async delete(itemIndex) {
		return await deleteRecord.call(this, itemIndex, '/videos', 'videoId');
	},
};
