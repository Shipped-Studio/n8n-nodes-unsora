import type { INodeProperties } from 'n8n-workflow';
import {
	idParameter,
	idempotencyKeyOption,
	returnAllAndLimit,
	showFor,
	waitForCompletionFields,
} from '../../shared/descriptions';

const RESOURCE = 'image';

export const imageDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: showFor(RESOURCE),
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Generate an image from a text prompt',
				action: 'Create an image',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an image generation',
				action: 'Delete an image',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get an image generation',
				action: 'Get an image',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List image generations',
				action: 'List images',
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				description: 'Get the status and output URL of an image generation',
				action: 'Get image status',
			},
		],
		default: 'create',
	},

	// ----- create -----
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		description: 'Describe the image to generate',
		displayOptions: showFor(RESOURCE, ['create']),
	},
	{
		displayName: 'Model Name or ID',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getImageModels' },
		default: 'nano-banana-2',
		description:
			'Image model to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: showFor(RESOURCE, ['create']),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(RESOURCE, ['create']),
		options: [
			{
				displayName: 'Aspect Ratio',
				name: 'aspectRatio',
				type: 'string',
				default: '',
				placeholder: '1:1',
				description:
					'Aspect ratio such as 1:1, 16:9 or 9:16. Valid values depend on the model; "auto" uses the model default.',
			},
			{
				...idempotencyKeyOption,
			},
			{
				displayName: 'Quality',
				name: 'quality',
				type: 'string',
				default: '',
				description: 'Quality tier, for models that offer it',
			},
			{
				displayName: 'Reference Image URLs',
				name: 'referenceImages',
				type: 'string',
				default: '',
				description:
					'Comma-separated public HTTPS reference image URLs. The maximum count depends on the model.',
			},
			{
				displayName: 'Resolution',
				name: 'resolution',
				type: 'string',
				default: '',
				placeholder: '2k',
				description: 'Output size such as 1k, 2k or 4k, for models that offer it',
			},
		],
	},
	...waitForCompletionFields(RESOURCE, 'create', { pollIntervalSeconds: 10, timeoutMinutes: 10 }),

	// ----- get / getStatus / delete -----
	idParameter(
		RESOURCE,
		['get', 'getStatus', 'delete'],
		'Image ID',
		'imageId',
		'ID of the image generation',
	),

	// ----- getAll -----
	...returnAllAndLimit(RESOURCE),
];
