import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationHandlers } from '../../shared/descriptions';
import { createJob, deleteRecord, getJobStatus, listRecords } from '../../shared/generation';
import { compact } from '../../shared/transport';
import { idempotencyHeaders } from '../../shared/utils';

const STATUS_PATH = '/music/status';

/** The only model that makes instrumentals (background music) and takes no lyrics. */
export const INSTRUMENTAL_MODEL = 'mureka-7.5';

export const musicOperations: OperationHandlers = {
	async create(itemIndex) {
		const additional = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
		const prompt = this.getNodeParameter('prompt', itemIndex, '') as string;
		const lyrics = this.getNodeParameter('lyrics', itemIndex, '') as string;
		const model = (additional.model as string | undefined) || 'auto';
		if (model === INSTRUMENTAL_MODEL) {
			if (!prompt.trim()) {
				throw new NodeOperationError(
					this.getNode(),
					'Enter a Style Prompt to describe the instrumental track',
					{ itemIndex },
				);
			}
		} else if (!lyrics.trim()) {
			throw new NodeOperationError(this.getNode(), 'Lyrics are required for songs', {
				itemIndex,
				description:
					'Every model except "Mureka 7.5 (Instrumental)" writes a song and needs lyrics. For background music without vocals, set Model to "Mureka 7.5 (Instrumental)" and describe it in Style Prompt.',
			});
		}
		const body = compact({
			prompt,
			lyrics: model === INSTRUMENTAL_MODEL ? undefined : lyrics,
			model,
			output_format: additional.outputFormat as string | undefined,
		});
		return await createJob.call(this, itemIndex, {
			path: '/music-generations/create',
			body,
			headers: idempotencyHeaders(additional.idempotencyKey),
			statusPath: STATUS_PATH,
			label: 'Music',
			defaults: { pollIntervalSeconds: 10, timeoutMinutes: 10 },
		});
	},

	async getStatus(itemIndex) {
		return await getJobStatus.call(this, itemIndex, STATUS_PATH, 'musicId');
	},

	async getAll(itemIndex) {
		return await listRecords.call(this, itemIndex, '/music-generations/all');
	},

	async delete(itemIndex) {
		return await deleteRecord.call(this, itemIndex, '/music-generations', 'musicId');
	},
};
