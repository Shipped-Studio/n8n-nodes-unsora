import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { UnsoraApi } from '../credentials/UnsoraApi.credentials';
import { Unsora } from '../nodes/Unsora/Unsora.node';
import { operationHandlers } from '../nodes/Unsora/resources';
import { UnsoraTrigger } from '../nodes/UnsoraTrigger/UnsoraTrigger.node';

const node = new Unsora();
const properties = node.description.properties;

function operationProperties(): Array<{ resource: string; options: INodePropertyOptions[] }> {
	return properties
		.filter((property: INodeProperties) => property.name === 'operation')
		.map((property) => ({
			resource: String(property.displayOptions?.show?.resource?.[0]),
			options: property.options as INodePropertyOptions[],
		}));
}

describe('UnsoraApi credential', () => {
	const credential = new UnsoraApi();

	it('sends the API key as a Bearer token', () => {
		expect(credential.name).toBe('unsoraApi');
		expect(credential.authenticate.properties.headers?.Authorization).toBe(
			'=Bearer {{$credentials.apiKey}}',
		);
	});

	it('tests the connection with GET /user/credits on the configured base URL', () => {
		expect(credential.test.request).toMatchObject({
			baseURL: '={{$credentials.baseUrl}}',
			url: '/user/credits',
			method: 'GET',
		});
	});

	it('stores the API key as a password and defaults the base URL', () => {
		const apiKey = credential.properties.find((p) => p.name === 'apiKey');
		const baseUrl = credential.properties.find((p) => p.name === 'baseUrl');
		expect(apiKey?.typeOptions?.password).toBe(true);
		expect(baseUrl?.default).toBe('https://mvp.tryunsora.com/api/v1');
	});
});

describe('Unsora node description', () => {
	it('is usable as an AI tool and uses the Unsora credential', () => {
		expect(node.description.usableAsTool).toBe(true);
		expect(node.description.credentials?.[0].name).toBe('unsoraApi');
	});

	it('has an operation selector for every resource', () => {
		const resource = properties.find((p) => p.name === 'resource');
		const resources = (resource?.options as INodePropertyOptions[]).map((o) => o.value);
		const withOperations = operationProperties().map((o) => o.resource);
		expect(withOperations.sort()).toEqual([...resources].sort());
	});

	it('implements a handler and an action label for every operation', () => {
		for (const { resource, options } of operationProperties()) {
			for (const option of options) {
				expect(option.action, `${resource}.${option.value} action`).toBeTruthy();
				expect(
					typeof operationHandlers[resource]?.[String(option.value)],
					`${resource}.${option.value} handler`,
				).toBe('function');
			}
		}
	});

	it('exposes every operation from the integration spec', () => {
		const ops = Object.fromEntries(
			operationProperties().map(({ resource, options }) => [
				resource,
				options.map((o) => o.value).sort(),
			]),
		);
		expect(ops).toEqual({
			account: ['getAll', 'getPinterestBoards', 'getTiktokCreatorInfo'],
			clipping: ['create', 'delete', 'deleteClip', 'get', 'getAll', 'getStatus'],
			image: ['create', 'delete', 'get', 'getAll', 'getStatus'],
			influencer: ['create', 'delete', 'getAll'],
			music: ['create', 'delete', 'getAll', 'getStatus'],
			post: ['create', 'delete', 'get', 'getAll', 'getAnalytics', 'publish', 'retry', 'update'],
			thumbnail: ['create', 'delete', 'get', 'getAll'],
			upload: ['createFromUrl', 'delete', 'getAll', 'uploadFile'],
			user: ['getCredits', 'getSubscription'],
			video: ['create', 'delete', 'getAll', 'getStatus'],
			voiceover: ['create', 'delete', 'getAll', 'getStatus', 'getVoices'],
		});
	});

	it('registers every loadOptions method referenced by a parameter', () => {
		const referenced = new Set<string>();
		const visit = (list: unknown[]) => {
			for (const entry of list as Array<Record<string, unknown>>) {
				const method = (entry.typeOptions as Record<string, unknown> | undefined)
					?.loadOptionsMethod;
				if (typeof method === 'string') referenced.add(method);
				if (Array.isArray(entry.options)) visit(entry.options);
				if (Array.isArray(entry.values)) visit(entry.values);
			}
		};
		visit(properties);
		for (const method of referenced) {
			expect(typeof node.methods.loadOptions[method as keyof typeof node.methods.loadOptions]).toBe(
				'function',
			);
		}
		expect(referenced.size).toBeGreaterThanOrEqual(6);
	});

	it('offers Wait for Completion (default on) on every async create operation', () => {
		for (const resource of [
			'clipping',
			'video',
			'image',
			'music',
			'voiceover',
			'thumbnail',
			'influencer',
		]) {
			const wait = properties.find(
				(p) => p.name === 'waitForCompletion' && p.displayOptions?.show?.resource?.[0] === resource,
			);
			expect(wait?.default, resource).toBe(true);
		}
	});
});

describe('Unsora Trigger description', () => {
	const trigger = new UnsoraTrigger();

	it('is a polling trigger with the three events', () => {
		expect(trigger.description.polling).toBe(true);
		expect(trigger.description.inputs).toEqual([]);
		const event = trigger.description.properties.find((p) => p.name === 'event');
		expect((event?.options as INodePropertyOptions[]).map((o) => o.value).sort()).toEqual([
			'clippingCompleted',
			'postFailed',
			'postPublished',
		]);
	});
});
