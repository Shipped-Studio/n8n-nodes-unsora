import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, sleep } from 'n8n-workflow';

export const CREDENTIAL_NAME = 'unsoraApi';
export const DEFAULT_BASE_URL = 'https://mvp.tryunsora.com/api/v1';

/** Longest we ever wait on a single Retry-After before trying again. */
const MAX_RETRY_AFTER_MS = 60_000;
const DEFAULT_RETRY_AFTER_MS = 15_000;

export type UnsoraContext = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

export interface UnsoraRequestOptions {
	body?: IDataObject | IDataObject[];
	qs?: IDataObject;
	headers?: Record<string, string>;
	itemIndex?: number;
	/** How many times a 429 response is retried after waiting for Retry-After. */
	maxRetries?: number;
}

interface FullResponse {
	body: unknown;
	headers: Record<string, string | string[] | undefined>;
	statusCode: number;
}

export async function getBaseUrl(this: UnsoraContext): Promise<string> {
	const credentials = await this.getCredentials(CREDENTIAL_NAME);
	const configured = typeof credentials.baseUrl === 'string' ? credentials.baseUrl.trim() : '';
	return (configured || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/** Removes undefined, null and empty-string values so they are not sent to the API. */
export function compact(object: IDataObject = {}): IDataObject {
	const result: IDataObject = {};
	for (const [key, value] of Object.entries(object)) {
		if (value === undefined || value === null || value === '') continue;
		result[key] = value;
	}
	return result;
}

/**
 * Delay before retrying a 429. Uses Retry-After when present; the API currently does not
 * send it for API keys, so the fallback is a fixed backoff that grows with each attempt.
 */
export function parseRetryAfter(value: string | string[] | undefined, attempt = 1): number {
	const raw = Array.isArray(value) ? value[0] : value;
	if (!raw) return Math.min(DEFAULT_RETRY_AFTER_MS * Math.max(attempt, 1), MAX_RETRY_AFTER_MS);
	const seconds = Number(raw);
	if (!Number.isNaN(seconds)) {
		return Math.min(Math.max(seconds, 1) * 1000, MAX_RETRY_AFTER_MS);
	}
	const date = Date.parse(raw);
	if (!Number.isNaN(date)) {
		return Math.min(Math.max(date - Date.now(), 1000), MAX_RETRY_AFTER_MS);
	}
	return Math.min(DEFAULT_RETRY_AFTER_MS * Math.max(attempt, 1), MAX_RETRY_AFTER_MS);
}

function hintForStatus(status: number): string | undefined {
	switch (status) {
		case 401:
			return 'Check that your Unsora API key is correct and has not been revoked. Create a new key at https://app.tryunsora.com/api-keys.';
		case 402:
			return 'Your Unsora account does not have enough credits for this action. Top up or upgrade at https://app.tryunsora.com.';
		case 403:
			return 'Your Unsora plan does not include this action, or the API key cannot access this resource. Check your plan at https://app.tryunsora.com.';
		case 404:
			return 'The requested Unsora resource was not found. Check the ID.';
		case 429:
			return 'Unsora allows 60 requests per minute per API key. Slow the workflow down (for example with a Wait node) and try again.';
		default:
			return undefined;
	}
}

export function buildApiError(
	node: INode,
	status: number,
	body: unknown,
	itemIndex?: number,
): NodeApiError {
	const data: IDataObject =
		body && typeof body === 'object' && !Array.isArray(body) ? (body as IDataObject) : {};
	const rawText = typeof body === 'string' && body.trim() ? body.trim().slice(0, 500) : undefined;
	const apiMessage =
		(typeof data.error === 'string' && data.error) ||
		(typeof data.message === 'string' && data.message) ||
		rawText ||
		`Request failed with status ${status}`;
	const code = typeof data.code === 'string' ? data.code : undefined;

	const message = `Unsora API error ${status}${code ? ` (${code})` : ''}: ${apiMessage}`;
	const hint = hintForStatus(status);

	const error = new NodeApiError(
		node,
		{ ...data, message: apiMessage, httpCode: String(status) } as JsonObject,
		{
			message,
			description: hint,
			httpCode: String(status),
			itemIndex,
		},
	);
	// Keep the machine-readable status and code so callers can react to specific errors.
	error.context.apiStatus = status;
	if (code) error.context.apiCode = code;
	return error;
}

/** Reads the HTTP status and Unsora error code that buildApiError attached to an error. */
export function apiErrorInfo(error: unknown): { status?: number; code?: string } {
	if (!(error instanceof NodeApiError)) return {};
	const context = (error.context ?? {}) as IDataObject;
	return {
		status: typeof context.apiStatus === 'number' ? context.apiStatus : undefined,
		code: typeof context.apiCode === 'string' ? context.apiCode : undefined,
	};
}

/**
 * Makes an authenticated request to the Unsora REST API.
 * Non-2xx responses are turned into a NodeApiError that carries the API's error text,
 * HTTP status and error code. 429 responses are retried after the Retry-After delay.
 */
export async function unsoraApiRequest(
	this: UnsoraContext,
	method: IHttpRequestMethods,
	path: string,
	options: UnsoraRequestOptions = {},
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
	const { body, qs, headers, itemIndex, maxRetries = 2 } = options;
	const baseUrl = await getBaseUrl.call(this);

	const request: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`,
		headers: { Accept: 'application/json', ...headers },
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	const query = compact(qs);
	if (Object.keys(query).length) request.qs = query;
	if (body !== undefined) request.body = body;

	let attempt = 0;
	for (;;) {
		let response: FullResponse;
		try {
			response = (await this.helpers.httpRequestWithAuthentication.call(
				this,
				CREDENTIAL_NAME,
				request,
			)) as FullResponse;
		} catch (error) {
			throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
		}

		const status = Number(response.statusCode);
		if (status >= 200 && status < 300) {
			return response.body === '' || response.body === undefined ? {} : response.body;
		}

		if (status === 429 && attempt < maxRetries) {
			attempt++;
			await sleep(parseRetryAfter(response.headers?.['retry-after'], attempt));
			continue;
		}

		throw buildApiError(this.getNode(), status, response.body, itemIndex);
	}
}
