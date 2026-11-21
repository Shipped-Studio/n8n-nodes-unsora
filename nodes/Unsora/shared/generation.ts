import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import type { OperationResult } from './descriptions';
import { getWaitParameters, waitForJob } from './polling';
import { unsoraApiRequest } from './transport';
import { extractJobIds, flattenCreateResponse, getManyRecords, unwrapData } from './utils';

export interface CreateJobOptions {
	path: string;
	body: IDataObject;
	headers?: Record<string, string>;
	statusPath: string;
	label: string;
	defaults: { pollIntervalSeconds: number; timeoutMinutes: number };
}

/**
 * Starts a generation job and, when "Wait for Completion" is on, polls until it finishes.
 * Jobs that create several generations (thumbnails, influencer images) return one item
 * per generation when waiting.
 */
export async function createJob(
	this: IExecuteFunctions,
	itemIndex: number,
	options: CreateJobOptions,
): Promise<OperationResult> {
	const response = (await unsoraApiRequest.call(this, 'POST', options.path, {
		body: options.body,
		headers: options.headers,
		itemIndex,
	})) as IDataObject;

	const { wait, pollIntervalSeconds, timeoutMinutes } = getWaitParameters.call(
		this,
		itemIndex,
		options.defaults,
	);
	const ids = extractJobIds(response);
	const isMulti = Array.isArray(response.generations);

	if (!wait || ids.length === 0) {
		return isMulti ? response : flattenCreateResponse(response);
	}

	const credits = {
		creditsDeducted: response.creditsDeducted,
		creditsRemaining: response.creditsRemaining,
	};
	const results: IDataObject[] = [];
	for (const id of ids) {
		const final = await waitForJob.call(this, id, {
			statusPath: options.statusPath,
			label: options.label,
			pollIntervalSeconds,
			timeoutMinutes,
			itemIndex,
		});
		results.push({ ...final, ...credits });
	}
	return isMulti ? results : results[0];
}

export async function getJobStatus(
	this: IExecuteFunctions,
	itemIndex: number,
	statusPath: string,
	idParameter: string,
): Promise<IDataObject> {
	const id = this.getNodeParameter(idParameter, itemIndex) as string;
	const response = await unsoraApiRequest.call(
		this,
		'GET',
		`${statusPath}/${encodeURIComponent(id)}`,
		{ itemIndex },
	);
	return unwrapData(response);
}

export async function getRecord(
	this: IExecuteFunctions,
	itemIndex: number,
	path: string,
	idParameter: string,
): Promise<IDataObject> {
	const id = this.getNodeParameter(idParameter, itemIndex) as string;
	const response = await unsoraApiRequest.call(this, 'GET', `${path}/${encodeURIComponent(id)}`, {
		itemIndex,
	});
	return unwrapData(response);
}

export async function deleteRecord(
	this: IExecuteFunctions,
	itemIndex: number,
	path: string,
	idParameter: string,
): Promise<IDataObject> {
	const id = this.getNodeParameter(idParameter, itemIndex) as string;
	const response = await unsoraApiRequest.call(
		this,
		'DELETE',
		`${path}/${encodeURIComponent(id)}`,
		{ itemIndex },
	);
	return { id, deleted: true, ...unwrapData(response) };
}

export async function listRecords(
	this: IExecuteFunctions,
	itemIndex: number,
	path: string,
	qs: IDataObject = {},
	paginated = true,
): Promise<IDataObject[]> {
	return await getManyRecords.call(this, path, itemIndex, { qs, paginated });
}
