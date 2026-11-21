import type { INodeProperties } from 'n8n-workflow';
import {
	idParameter,
	idempotencyKeyOption,
	returnAllAndLimit,
	showFor,
	waitForCompletionFields,
} from '../../shared/descriptions';

const RESOURCE = 'video';

export const videoDescription: INodeProperties[] = [
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
				description: 'Generate a video from a text prompt or images',
				action: 'Create a video',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a video generation',
				action: 'Delete a video',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List video generations',
				action: 'List videos',
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				description: 'Get the status and output URL of a video generation',
				action: 'Get video status',
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
		description: 'Describe the video to generate',
		displayOptions: showFor(RESOURCE, ['create']),
	},
	{
		displayName: 'Model Name or ID',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getVideoModels' },
		default: 'seedance-2.0',
		description:
			'Video model to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
				default: '16:9',
				placeholder: '9:16',
				description: 'Aspect ratio such as 16:9, 9:16 or 1:1. Valid values depend on the model.',
			},
			{
				displayName: 'Duration (Seconds)',
				name: 'duration',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 5,
				description: 'Length of the video. Valid values depend on the model.',
			},
			{
				displayName: 'End Image URL',
				name: 'lastImage',
				type: 'string',
				default: '',
				description: 'Last frame image, for models that support start and end frames',
			},
			{
				displayName: 'Generate Sound',
				name: 'sound',
				type: 'boolean',
				default: true,
				description: 'Whether to generate audio, for models that offer it',
			},
			{
				...idempotencyKeyOption,
			},
			{
				displayName: 'Negative Prompt',
				name: 'negativePrompt',
				type: 'string',
				default: '',
				description: 'What to avoid in the video. Not supported by Sora or Seedance models.',
			},
			{
				displayName: 'Reference Image URLs',
				name: 'referenceImages',
				type: 'string',
				default: '',
				description: 'Comma-separated reference image URLs, for models that support reference mode',
			},
			{
				displayName: 'Resolution',
				name: 'resolution',
				type: 'string',
				default: '',
				placeholder: '1080p',
				description: 'Output resolution such as 720p or 1080p, for models that offer it',
			},
			{
				displayName: 'Start Image URL',
				name: 'image',
				type: 'string',
				default: '',
				description: 'Start image for image-to-video',
			},
		],
	},
	...waitForCompletionFields(RESOURCE, 'create', { pollIntervalSeconds: 10, timeoutMinutes: 10 }),

	// ----- getStatus / delete -----
	idParameter(
		RESOURCE,
		['getStatus', 'delete'],
		'Video ID',
		'videoId',
		'ID of the video generation',
	),

	// ----- getAll -----
	...returnAllAndLimit(RESOURCE),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(RESOURCE, ['getAll']),
		options: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: '',
				placeholder: 'seedance-2.0',
				description: 'Only return videos made with this model key',
			},
		],
	},
];
