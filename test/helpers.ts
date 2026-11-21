import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	INodeExecutionData,
	IPollFunctions,
} from 'n8n-workflow';

export interface MockResponse {
	statusCode?: number;
	body?: unknown;
	headers?: Record<string, string>;
}

export type Responder = (request: IHttpRequestOptions) => MockResponse;

export const BASE_URL = 'https://api.test/api/v1';

export const fakeNode: INode = {
	id: 'node-1',
	name: 'Unsora',
	type: 'n8n-nodes-unsora.unsora',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

/** Records every request and answers from a queue of responses (or a function). */
export function createHttpMock(responses: Array<MockResponse | Responder>) {
	const requests: IHttpRequestOptions[] = [];
	const queue = [...responses];
	const httpRequestWithAuthentication = async (
		credentialType: string,
		request: IHttpRequestOptions,
	) => {
		if (credentialType !== 'unsoraApi') throw new Error(`unexpected credential ${credentialType}`);
		requests.push(request);
		const next = queue.length > 1 ? queue.shift() : queue[0];
		if (!next) throw new Error(`no mock response for ${request.method} ${request.url}`);
		const response = typeof next === 'function' ? next(request) : next;
		return {
			statusCode: response.statusCode ?? 200,
			body: response.body ?? {},
			headers: response.headers ?? {},
		};
	};
	return { requests, httpRequestWithAuthentication };
}

function getPath(object: IDataObject, path: string): unknown {
	return path.split('.').reduce<unknown>((value, key) => {
		if (value && typeof value === 'object') return (value as IDataObject)[key];
		return undefined;
	}, object);
}

export interface ExecuteContextOptions {
	params: IDataObject;
	responses: Array<MockResponse | Responder>;
	items?: INodeExecutionData[];
	binary?: Record<string, { data: IBinaryData; buffer: Buffer }>;
	continueOnFail?: boolean;
	timezone?: string;
	/** Answers unauthenticated requests (helpers.httpRequest), e.g. storage uploads. */
	plainResponder?: (request: IHttpRequestOptions) => unknown;
}

export function createExecuteContext(options: ExecuteContextOptions) {
	const http = createHttpMock(options.responses);
	const items = options.items ?? [{ json: {} }];
	const plainRequests: IHttpRequestOptions[] = [];
	const context = {
		getInputData: () => items,
		getNode: () => fakeNode,
		getTimezone: () => options.timezone ?? 'UTC',
		continueOnFail: () => options.continueOnFail ?? false,
		getExecutionCancelSignal: () => undefined,
		getCredentials: async () => ({ apiKey: 'uns_test', baseUrl: `${BASE_URL}/` }),
		getNodeParameter: (name: string, _itemIndex: number, fallback?: unknown) => {
			const value = getPath(options.params, name);
			if (value === undefined) {
				if (fallback !== undefined) return fallback;
				throw new Error(`Missing parameter ${name}`);
			}
			return value;
		},
		helpers: {
			httpRequestWithAuthentication: http.httpRequestWithAuthentication,
			httpRequest: async (request: IHttpRequestOptions) => {
				plainRequests.push(request);
				if (!options.plainResponder) throw new Error(`unexpected request to ${request.url}`);
				return options.plainResponder(request);
			},
			returnJsonArray: (data: IDataObject | IDataObject[]) =>
				(Array.isArray(data) ? data : [data]).map((json) => ({ json })),
			constructExecutionMetaData: (
				data: INodeExecutionData[],
				meta: { itemData: { item: number } },
			) => data.map((entry) => ({ ...entry, pairedItem: meta.itemData })),
			assertBinaryData: (_itemIndex: number, name: string) => {
				const entry = options.binary?.[name];
				if (!entry) throw new Error(`No binary data in property ${name}`);
				return entry.data;
			},
			getBinaryDataBuffer: async (_itemIndex: number, name: string) => {
				const entry = options.binary?.[name];
				if (!entry) throw new Error(`No binary data in property ${name}`);
				return entry.buffer;
			},
		},
	};
	return {
		context: context as unknown as IExecuteFunctions,
		requests: http.requests,
		plainRequests,
	};
}

export function createLoadOptionsContext(
	responses: Array<MockResponse | Responder>,
	currentParams: IDataObject = {},
) {
	const http = createHttpMock(responses);
	const context = {
		getNode: () => fakeNode,
		getCredentials: async () => ({ apiKey: 'uns_test', baseUrl: BASE_URL }),
		getCurrentNodeParameter: (name: string) => currentParams[name],
		helpers: { httpRequestWithAuthentication: http.httpRequestWithAuthentication },
	};
	return { context: context as unknown as ILoadOptionsFunctions, requests: http.requests };
}

export function createPollContext(options: {
	event: string;
	responses: Array<MockResponse | Responder>;
	mode?: 'manual' | 'trigger';
	staticData?: IDataObject;
}) {
	const http = createHttpMock(options.responses);
	const staticData = options.staticData ?? {};
	const context = {
		getNode: () => fakeNode,
		getMode: () => options.mode ?? 'trigger',
		getCredentials: async () => ({ apiKey: 'uns_test', baseUrl: BASE_URL }),
		getNodeParameter: (name: string) => (name === 'event' ? options.event : undefined),
		getWorkflowStaticData: () => staticData,
		helpers: { httpRequestWithAuthentication: http.httpRequestWithAuthentication },
	};
	return { context: context as unknown as IPollFunctions, requests: http.requests, staticData };
}
