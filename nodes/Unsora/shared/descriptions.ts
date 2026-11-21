import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

export type OperationResult = IDataObject | IDataObject[];

export type OperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
) => Promise<OperationResult>;

export type OperationHandlers = Record<string, OperationHandler>;

export function showFor(resource: string, operations?: string[]) {
	return {
		show: operations ? { resource: [resource], operation: operations } : { resource: [resource] },
	};
}

/** "Return All" + "Limit" parameters for a Get Many operation. */
export function returnAllAndLimit(
	resource: string,
	operation = 'getAll',
	maxLimit = 100,
): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: showFor(resource, [operation]),
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: maxLimit },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: {
				show: { resource: [resource], operation: [operation], returnAll: [false] },
			},
		},
	];
}

/** "Wait for Completion" + polling parameters for a create operation. */
export function waitForCompletionFields(
	resource: string,
	operation: string,
	defaults: { pollIntervalSeconds: number; timeoutMinutes: number },
): INodeProperties[] {
	const whileWaiting = {
		show: { resource: [resource], operation: [operation], waitForCompletion: [true] },
	};
	const pollInterval: INodeProperties = {
		displayName: 'Poll Interval (Seconds)',
		name: 'pollInterval',
		type: 'number',
		typeOptions: { minValue: 5 },
		default: 10,
		description: 'How often to check the job status while waiting (minimum 5 seconds)',
		displayOptions: whileWaiting,
	};
	const timeout: INodeProperties = {
		displayName: 'Timeout (Minutes)',
		name: 'timeout',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 10,
		description:
			'How long to wait before giving up. The job keeps running in Unsora after a timeout.',
		displayOptions: whileWaiting,
	};
	pollInterval.default = defaults.pollIntervalSeconds;
	timeout.default = defaults.timeoutMinutes;

	return [
		{
			displayName: 'Wait for Completion',
			name: 'waitForCompletion',
			type: 'boolean',
			default: true,
			description:
				'Whether to wait until the job finishes and return the final result. Turn off to return the job ID right away and check it later with "Get Status".',
			displayOptions: showFor(resource, [operation]),
		},
		pollInterval,
		timeout,
	];
}

/** A required string ID parameter. */
export function idParameter(
	resource: string,
	operations: string[],
	displayName: string,
	name: string,
	description: string,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'string',
		required: true,
		default: '',
		description,
		displayOptions: showFor(resource, operations),
	};
}

export const idempotencyKeyOption: INodeProperties = {
	displayName: 'Idempotency Key',
	name: 'idempotencyKey',
	type: 'string',
	default: '',
	description:
		'Unique key (max 128 characters) that makes retries safe: sending the same key again within 24 hours returns the first response instead of creating a duplicate',
};
