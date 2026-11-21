import type { IDataObject } from 'n8n-workflow';
import type { OperationHandlers } from '../../shared/descriptions';
import {
	createJob,
	deleteRecord,
	getJobStatus,
	getRecord,
	listRecords,
} from '../../shared/generation';
import { compact } from '../../shared/transport';
import { idempotencyHeaders, toList } from '../../shared/utils';

const STATUS_PATH = '/image/status';

export const imageOperations: OperationHandlers = {
	async create(itemIndex) {
		const additional = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
		const referenceImages = toList(additional.referenceImages);
		const body = compact({
			prompt: this.getNodeParameter('prompt', itemIndex) as string,
			model: this.getNodeParameter('model', itemIndex, 'nano-banana-2') as string,
			aspectRatio: additional.aspectRatio as string | undefined,
			resolution: additional.resolution as string | undefined,
			quality: additional.quality as string | undefined,
			referenceImages: referenceImages.length ? referenceImages : undefined,
		});
		return await createJob.call(this, itemIndex, {
			path: '/image-generations/create',
			body,
			headers: idempotencyHeaders(additional.idempotencyKey),
			statusPath: STATUS_PATH,
			label: 'Image',
			defaults: { pollIntervalSeconds: 10, timeoutMinutes: 10 },
		});
	},

	async get(itemIndex) {
		return await getRecord.call(this, itemIndex, '/image-generations', 'imageId');
	},

	async getStatus(itemIndex) {
		return await getJobStatus.call(this, itemIndex, STATUS_PATH, 'imageId');
	},

	async getAll(itemIndex) {
		return await listRecords.call(this, itemIndex, '/image-generations/all');
	},

	async delete(itemIndex) {
		return await deleteRecord.call(this, itemIndex, '/image-generations', 'imageId');
	},
};
