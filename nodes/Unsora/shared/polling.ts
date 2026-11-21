import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError, sleep } from 'n8n-workflow';
import { unsoraApiRequest } from './transport';
import { unwrapData } from './utils';

export const SUCCESS_STATUSES = ['COMPLETED'];
export const FAILURE_STATUSES = ['FAILED', 'CANCELLED'];

/** Never poll faster than this, so a single workflow stays well under 60 requests per minute. */
export const MIN_POLL_INTERVAL_SECONDS = 5;

export interface WaitOptions {
	/** Path of the status endpoint without the ID, e.g. `/video/status`. */
	statusPath: string;
	/** Human-readable job name used in error messages, e.g. `Video`. */
	label: string;
	pollIntervalSeconds: number;
	timeoutMinutes: number;
	itemIndex: number;
}

/**
 * Polls a job's status endpoint until it reaches a terminal status.
 * Resolves with the final status payload on COMPLETED and throws on FAILED,
 * CANCELLED, timeout or when the execution is cancelled.
 */
export async function waitForJob(
	this: IExecuteFunctions,
	id: string,
	options: WaitOptions,
): Promise<IDataObject> {
	const { statusPath, label, itemIndex } = options;
	const intervalMs =
		Math.max(Number(options.pollIntervalSeconds) || 0, MIN_POLL_INTERVAL_SECONDS) * 1000;
	const timeoutMs = Math.max(Number(options.timeoutMinutes) || 0, 0) * 60_000;
	const startedAt = Date.now();
	const node = this.getNode();

	for (;;) {
		const response = await unsoraApiRequest.call(
			this,
			'GET',
			`${statusPath}/${encodeURIComponent(id)}`,
			{ itemIndex, maxRetries: 5 },
		);
		const data = unwrapData(response);
		const status = String(data.status ?? '').toUpperCase();

		if (SUCCESS_STATUSES.includes(status)) return data;

		if (FAILURE_STATUSES.includes(status)) {
			const reason = typeof data.error === 'string' && data.error ? data.error : 'No reason given';
			throw new NodeOperationError(node, `${label} ${status.toLowerCase()}: ${reason}`, {
				itemIndex,
				description: `Job ID: ${id}`,
			});
		}

		if (Date.now() - startedAt + intervalMs > timeoutMs) {
			throw new NodeOperationError(
				node,
				`${label} ${id} is still ${status || 'processing'} after ${options.timeoutMinutes} minute(s)`,
				{
					itemIndex,
					description:
						'The job keeps running in Unsora. Increase "Timeout (Minutes)", or turn off "Wait for Completion" and check it later with the "Get Status" operation using this job ID.',
				},
			);
		}

		if (this.getExecutionCancelSignal?.()?.aborted) {
			throw new NodeOperationError(
				node,
				`Stopped waiting for ${label} ${id}: execution cancelled`,
				{
					itemIndex,
				},
			);
		}

		await cancellableSleep.call(this, intervalMs);
	}
}

/** Sleeps in short steps so a cancelled execution stops waiting within about a second. */
async function cancellableSleep(this: IExecuteFunctions, ms: number): Promise<void> {
	const signal = this.getExecutionCancelSignal?.();
	if (!signal) {
		await sleep(ms);
		return;
	}
	const endAt = Date.now() + ms;
	while (!signal.aborted) {
		const remaining = endAt - Date.now();
		if (remaining <= 0) return;
		await sleep(Math.min(remaining, 1000));
	}
}

/** Reads the shared "Wait for Completion" parameters for an item. */
export function getWaitParameters(
	this: IExecuteFunctions,
	itemIndex: number,
	defaults: { pollIntervalSeconds: number; timeoutMinutes: number },
): { wait: boolean; pollIntervalSeconds: number; timeoutMinutes: number } {
	const wait = this.getNodeParameter('waitForCompletion', itemIndex, true) as boolean;
	if (!wait) return { wait, ...defaults };
	return {
		wait,
		pollIntervalSeconds: this.getNodeParameter(
			'pollInterval',
			itemIndex,
			defaults.pollIntervalSeconds,
		) as number,
		timeoutMinutes: this.getNodeParameter('timeout', itemIndex, defaults.timeoutMinutes) as number,
	};
}
