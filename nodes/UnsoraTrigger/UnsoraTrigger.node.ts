import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { unsoraApiRequest } from '../Unsora/shared/transport';
import { extractList, withClipUrls } from '../Unsora/shared/utils';

/** How many already-seen event keys are remembered between polls. */
const MAX_SEEN_KEYS = 1000;
/** How many of the most recent events are compared on each poll. */
export const POLL_WINDOW = 100;
/**
 * Events older than the trigger's activation (minus this margin for clock differences)
 * are never emitted, so a long history can't flood the workflow.
 */
const ACTIVATION_GRACE_MS = 10 * 60_000;

interface TriggerStaticData {
	initialized?: boolean;
	activatedAt?: number;
	seenIds?: string[];
}

function parseTime(value: unknown): number {
	const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
	return Number.isNaN(parsed) ? 0 : parsed;
}

/** When the event happened: completion, publication or failure time. */
export function eventTime(record: IDataObject, event = ''): number {
	if (event === 'postPublished') {
		return (
			parseTime(record.publishedAt) || parseTime(record.updatedAt) || parseTime(record.createdAt)
		);
	}
	return (
		parseTime(record.updatedAt) || parseTime(record.publishedAt) || parseTime(record.createdAt)
	);
}

/** Newest first. */
export function sortNewestFirst(records: IDataObject[], event = ''): IDataObject[] {
	return [...records].sort((a, b) => eventTime(b, event) - eventTime(a, event));
}

/**
 * Dedupe key. A post can fail, be retried and fail again, so Post Failed includes the
 * failure time; the other events happen once per record.
 */
export function eventKey(record: IDataObject, event: string): string {
	const id = String(record.id);
	if (event === 'postFailed') return `${id}:${String(record.updatedAt ?? '')}`;
	return id;
}

async function fetchEventRecords(this: IPollFunctions, event: string): Promise<IDataObject[]> {
	if (event === 'clippingCompleted') {
		// Older API versions ignore these parameters and return every clipping; the
		// status filter and window below handle that.
		const response = await unsoraApiRequest.call(this, 'GET', '/clippings/all', {
			qs: { status: 'COMPLETED', sort: 'updated', limit: POLL_WINDOW },
		});
		return extractList(response)
			.filter((record) => String(record.status ?? '').toUpperCase() === 'COMPLETED')
			.map(withClipUrls);
	}
	const status = event === 'postPublished' ? 'PUBLISHED' : 'FAILED';
	const response = await unsoraApiRequest.call(this, 'GET', '/posts', {
		qs: { status, sort: 'updated', page: 1, limit: POLL_WINDOW },
	});
	return extractList(response).filter(
		(record) => String(record.status ?? '').toUpperCase() === status,
	);
}

export class UnsoraTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Unsora Trigger',
		name: 'unsoraTrigger',
		icon: { light: 'file:../../icons/unsora.svg', dark: 'file:../../icons/unsora.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description:
			'Starts the workflow when an Unsora clipping finishes or a post publishes or fails',
		defaults: {
			name: 'Unsora Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'unsoraApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Clipping Completed',
						value: 'clippingCompleted',
						description: 'A clipping job finished and its clips are ready',
					},
					{
						name: 'Post Failed',
						value: 'postFailed',
						description:
							'A post failed to publish on every account. Fires again if a retried post fails again.',
					},
					{
						name: 'Post Published',
						value: 'postPublished',
						description: 'A post was published on every account',
					},
				],
				default: 'clippingCompleted',
			},
			{
				displayName:
					'New events are detected by polling Unsora. Events that already existed when the workflow was activated are skipped.',
				name: 'pollingNotice',
				type: 'notice',
				default: '',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		const records = sortNewestFirst(await fetchEventRecords.call(this, event), event).slice(
			0,
			POLL_WINDOW,
		);

		// Manual test run: return the most recent matching record so the user can map fields.
		if (this.getMode() === 'manual') {
			return records.length ? [[{ json: records[0] }]] : null;
		}

		const staticData = this.getWorkflowStaticData('node') as TriggerStaticData;
		const keys = records.map((record) => eventKey(record, event));

		if (!staticData.initialized) {
			staticData.initialized = true;
			staticData.activatedAt = Date.now();
			staticData.seenIds = keys.slice(0, MAX_SEEN_KEYS);
			return null;
		}
		if (typeof staticData.activatedAt !== 'number') staticData.activatedAt = Date.now();

		const previous = staticData.seenIds ?? [];
		const seen = new Set(previous);
		const notBefore = staticData.activatedAt - ACTIVATION_GRACE_MS;
		const fresh = records.filter(
			(record) => !seen.has(eventKey(record, event)) && eventTime(record, event) >= notBefore,
		);

		// Newest keys first, so trimming only ever drops the oldest ones.
		staticData.seenIds = [...new Set([...keys, ...previous])].slice(0, MAX_SEEN_KEYS);

		if (fresh.length === 0) return null;
		// Emit oldest first so downstream steps run in the order events happened.
		return [fresh.reverse().map((record) => ({ json: record }))];
	}
}
