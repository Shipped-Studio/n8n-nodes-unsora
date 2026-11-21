import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError, jsonParse } from 'n8n-workflow';
import { unsoraApiRequest } from './transport';

/** Splits a comma or newline separated string (or an array) into trimmed, non-empty values. */
export function toList(value: unknown): string[] {
	if (value === undefined || value === null || value === '') return [];
	const parts = Array.isArray(value) ? value : String(value).split(/[\n,]/);
	return parts.map((part) => String(part).trim()).filter((part) => part.length > 0);
}

/**
 * Returns the record inside a response: `response.data` when the API wraps its payload,
 * `response.generation` for single-generation reads, otherwise the response itself.
 */
export function unwrapData(response: unknown): IDataObject {
	if (response && typeof response === 'object' && !Array.isArray(response)) {
		const root = response as IDataObject;
		const data = root.data;
		if (data && typeof data === 'object' && !Array.isArray(data)) return data as IDataObject;
		const generation = root.generation;
		const keys = Object.keys(root).filter((key) => key !== 'success' && key !== 'message');
		if (
			generation &&
			typeof generation === 'object' &&
			!Array.isArray(generation) &&
			keys.length === 1
		) {
			return generation as IDataObject;
		}
		return root;
	}
	return { result: response as IDataObject[keyof IDataObject] };
}

const LIST_KEYS = ['generations', 'posts', 'uploads', 'voices', 'models', 'items', 'results'];

/** Finds the array of records inside a list response. */
export function extractList(response: unknown): IDataObject[] {
	if (Array.isArray(response)) return response as IDataObject[];
	if (!response || typeof response !== 'object') return [];
	const root = response as IDataObject;
	if (Array.isArray(root.data)) return root.data as IDataObject[];
	for (const container of [root, root.data]) {
		if (!container || typeof container !== 'object' || Array.isArray(container)) continue;
		for (const key of LIST_KEYS) {
			const value = (container as IDataObject)[key];
			if (Array.isArray(value)) return value as IDataObject[];
		}
	}
	return [];
}

/** Reads the total page count from either pagination shape the API uses. */
export function extractTotalPages(response: unknown): number | undefined {
	if (!response || typeof response !== 'object') return undefined;
	const root = response as IDataObject;
	const candidates = [root.pagination, (root.data as IDataObject | undefined)?.pagination];
	for (const pagination of candidates) {
		if (pagination && typeof pagination === 'object') {
			const total = (pagination as IDataObject).totalPages;
			if (typeof total === 'number') return total;
		}
	}
	return undefined;
}

/** Collects job IDs from a create response (`generation`, `generations[]` or `data`). */
export function extractJobIds(response: IDataObject): string[] {
	const generation = response.generation as IDataObject | undefined;
	if (generation?.id) return [String(generation.id)];
	const generations = response.generations as IDataObject[] | undefined;
	if (Array.isArray(generations)) {
		return generations.map((item) => String(item.id)).filter((id) => id && id !== 'undefined');
	}
	const data = response.data as IDataObject | undefined;
	if (data?.id) return [String(data.id)];
	return [];
}

/** Flattens a create response into one object: the job fields plus credit info. */
export function flattenCreateResponse(response: IDataObject): IDataObject {
	const { success, generation, data, ...rest } = response;
	void success;
	const job =
		(generation as IDataObject | undefined) ??
		(data && typeof data === 'object' && !Array.isArray(data) ? (data as IDataObject) : {});
	return { ...job, ...rest };
}

/**
 * Adds a `clipUrl` field to every clip of a clipping job: the first of
 * `outputAsset.url`, `url` or `videoUrl`, so workflows have one field to map.
 */
export function withClipUrls(job: IDataObject): IDataObject {
	if (!Array.isArray(job.clips)) return job;
	const clips = (job.clips as IDataObject[]).map((clip) => {
		if (!clip || typeof clip !== 'object' || clip.clipUrl) return clip;
		const asset = clip.outputAsset as IDataObject | null | undefined;
		const url = asset?.url ?? clip.url ?? clip.videoUrl;
		return url ? { ...clip, clipUrl: url } : clip;
	});
	return { ...job, clips };
}

/** Builds request headers that carry an optional Idempotency-Key. */
export function idempotencyHeaders(key: unknown): Record<string, string> | undefined {
	if (typeof key !== 'string' || !key.trim()) return undefined;
	return { 'Idempotency-Key': key.trim().slice(0, 128) };
}

export function parseJsonParameter(
	this: IExecuteFunctions,
	value: unknown,
	fieldName: string,
	itemIndex: number,
): IDataObject {
	if (value === undefined || value === null || value === '') return {};
	if (typeof value === 'object' && !Array.isArray(value)) return value as IDataObject;
	try {
		const parsed = jsonParse<IDataObject>(String(value));
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error('not an object');
		}
		return parsed;
	} catch {
		throw new NodeOperationError(this.getNode(), `${fieldName} must be a JSON object`, {
			itemIndex,
		});
	}
}

function timeZoneOffsetMs(epochMs: number, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).formatToParts(new Date(epochMs));
	const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
	const asUtc = Date.UTC(
		get('year'),
		get('month') - 1,
		get('day'),
		get('hour'),
		get('minute'),
		get('second'),
	);
	return asUtc - Math.floor(epochMs / 1000) * 1000;
}

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;
const LOCAL_DATE_TIME =
	/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;

/**
 * Converts a date-time parameter to an ISO 8601 string with an explicit offset.
 * Values without an offset (what the n8n date picker produces) are read in `timeZone`,
 * which is the workflow's time zone.
 */
export function toIsoDateTime(value: unknown, timeZone: string): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value === 'number') return new Date(value).toISOString();
	if (typeof value === 'object') {
		const candidate = value as { toISO?: () => string; toISOString?: () => string };
		if (typeof candidate.toISO === 'function') return candidate.toISO();
		if (typeof candidate.toISOString === 'function') return candidate.toISOString();
	}
	const text = String(value).trim();
	if (HAS_OFFSET.test(text)) {
		const parsed = Date.parse(text);
		return Number.isNaN(parsed) ? text : new Date(parsed).toISOString();
	}
	const match = LOCAL_DATE_TIME.exec(text);
	if (!match) {
		const parsed = Date.parse(text);
		return Number.isNaN(parsed) ? text : new Date(parsed).toISOString();
	}
	const [, y, mo, d, h = '0', mi = '0', s = '0', ms = '0'] = match;
	const wallClockAsUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, +ms.padEnd(3, '0'));
	let epoch = wallClockAsUtc - timeZoneOffsetMs(wallClockAsUtc, timeZone);
	// Second pass corrects the offset when the first guess crossed a DST change.
	epoch = wallClockAsUtc - timeZoneOffsetMs(epoch, timeZone);
	return new Date(epoch).toISOString();
}

export interface GetManyOptions {
	qs?: IDataObject;
	/** False for endpoints that return everything in one response. */
	paginated?: boolean;
	/** Largest page size the endpoint accepts. */
	maxPageSize?: number;
}

/** Implements the standard "Return All" / "Limit" pattern on top of the API's page-based lists. */
export async function getManyRecords(
	this: IExecuteFunctions,
	path: string,
	itemIndex: number,
	options: GetManyOptions = {},
): Promise<IDataObject[]> {
	const { qs = {}, paginated = true, maxPageSize = 100 } = options;
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = returnAll
		? Number.POSITIVE_INFINITY
		: (this.getNodeParameter('limit', itemIndex, 50) as number);

	if (!paginated) {
		const response = await unsoraApiRequest.call(this, 'GET', path, { qs, itemIndex });
		const records = extractList(response);
		return returnAll ? records : records.slice(0, limit);
	}

	const pageSize = returnAll ? maxPageSize : Math.min(Math.max(limit, 1), maxPageSize);
	const results: IDataObject[] = [];
	// Hard stop so a misbehaving pagination object can never loop forever.
	for (let page = 1; page <= 1000; page++) {
		const response = await unsoraApiRequest.call(this, 'GET', path, {
			qs: { ...qs, page, limit: pageSize },
			itemIndex,
		});
		const records = extractList(response);
		results.push(...records);
		if (results.length >= limit) break;
		const totalPages = extractTotalPages(response);
		if (records.length === 0) break;
		if (totalPages !== undefined ? page >= totalPages : records.length < pageSize) break;
	}
	return returnAll ? results : results.slice(0, limit);
}
