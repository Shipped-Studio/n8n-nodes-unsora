import type { IDataObject } from 'n8n-workflow';
import type { OperationHandlers } from '../../shared/descriptions';
import { createJob, deleteRecord, listRecords } from '../../shared/generation';
import { compact } from '../../shared/transport';
import { idempotencyHeaders } from '../../shared/utils';

export const influencerOperations: OperationHandlers = {
	async create(itemIndex) {
		const additional = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
		const body = compact({
			prompt: this.getNodeParameter('prompt', itemIndex) as string,
			aspectRatio: additional.aspectRatio as string | undefined,
			count: additional.count as number | undefined,
			cameraAngle: additional.cameraAngle as string | undefined,
			styleMode: additional.styleMode as string | undefined,
			age: additional.age as number | undefined,
		});
		return await createJob.call(this, itemIndex, {
			path: '/influencer-studio/create',
			body,
			headers: idempotencyHeaders(additional.idempotencyKey),
			statusPath: '/image/status',
			label: 'Influencer image',
			defaults: { pollIntervalSeconds: 10, timeoutMinutes: 10 },
		});
	},

	async getAll(itemIndex) {
		return await listRecords.call(this, itemIndex, '/influencer-studio/all');
	},

	async delete(itemIndex) {
		return await deleteRecord.call(this, itemIndex, '/influencer-studio', 'influencerId');
	},
};
