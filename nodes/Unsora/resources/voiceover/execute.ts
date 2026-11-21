import type { IDataObject } from 'n8n-workflow';
import type { OperationHandlers } from '../../shared/descriptions';
import { createJob, deleteRecord, getJobStatus, listRecords } from '../../shared/generation';
import { compact, unsoraApiRequest } from '../../shared/transport';
import { extractList, idempotencyHeaders } from '../../shared/utils';

const STATUS_PATH = '/voiceovers/status';

export const voiceoverOperations: OperationHandlers = {
	async create(itemIndex) {
		const additional = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
		const body = compact({
			text: this.getNodeParameter('text', itemIndex) as string,
			voice_id: this.getNodeParameter('voiceId', itemIndex) as string,
			stability: additional.stability as number | undefined,
			similarity: additional.similarity as number | undefined,
		});
		return await createJob.call(this, itemIndex, {
			path: '/voiceovers/create',
			body,
			headers: idempotencyHeaders(additional.idempotencyKey),
			statusPath: STATUS_PATH,
			label: 'Voiceover',
			defaults: { pollIntervalSeconds: 10, timeoutMinutes: 10 },
		});
	},

	async getVoices(itemIndex) {
		const response = await unsoraApiRequest.call(this, 'GET', '/voiceovers/voices', { itemIndex });
		return extractList(response);
	},

	async getStatus(itemIndex) {
		return await getJobStatus.call(this, itemIndex, STATUS_PATH, 'voiceoverId');
	},

	async getAll(itemIndex) {
		return await listRecords.call(this, itemIndex, '/voiceovers/all');
	},

	async delete(itemIndex) {
		return await deleteRecord.call(this, itemIndex, '/voiceovers', 'voiceoverId');
	},
};
