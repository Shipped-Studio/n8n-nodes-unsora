import type { INodeProperties } from 'n8n-workflow';
import {
	idParameter,
	idempotencyKeyOption,
	returnAllAndLimit,
	showFor,
	waitForCompletionFields,
} from '../../shared/descriptions';

const RESOURCE = 'clipping';

export const clippingDescription: INodeProperties[] = [
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
				description: 'Turn a long video into short viral clips with AI',
				action: 'Create a clipping',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a clipping job and its clips',
				action: 'Delete a clipping',
			},
			{
				name: 'Delete Clip',
				value: 'deleteClip',
				description: 'Delete one clip from a clipping job',
				action: 'Delete a clip',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a clipping job and its clips without refreshing its status',
				action: 'Get a clipping',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List clipping jobs',
				action: 'List clippings',
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				description: 'Refresh and get the status of a clipping job, including finished clips',
				action: 'Get clipping status',
			},
		],
		default: 'create',
	},

	// ----- create -----
	{
		displayName: 'Video URL',
		name: 'videoUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://www.youtube.com/watch?v=...',
		description:
			'Public URL of the long video to clip, such as a YouTube link or an uploaded file URL',
		displayOptions: showFor(RESOURCE, ['create']),
	},
	{
		displayName: 'Clip Length',
		name: 'targetDuration',
		type: 'options',
		options: [
			{ name: '3–5min', value: 'gt3min' },
			{ name: '30–60s', value: '30-60' },
			{ name: '60–90s', value: '60-90' },
			{ name: '90s–3min', value: '90-3min' },
			{ name: 'Auto (Up to 90s)', value: 'auto' },
			{ name: 'Under 30s', value: 'lt30' },
		],
		default: 'auto',
		description: 'Target length of each clip',
		displayOptions: showFor(RESOURCE, ['create']),
	},
	{
		displayName: 'Aspect Ratio',
		name: 'ratio',
		type: 'options',
		options: [
			{ name: 'Landscape 16:9', value: '16:9' },
			{ name: 'Original', value: 'original' },
			{ name: 'Portrait 4:5', value: '4:5' },
			{ name: 'Square 1:1', value: '1:1' },
			{ name: 'Vertical 9:16', value: '9:16' },
		],
		default: 'original',
		description: 'Aspect ratio of the clips. Use Vertical 9:16 for TikTok, Reels and Shorts.',
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
				displayName: 'Caption Language',
				name: 'targetLang',
				type: 'string',
				default: '',
				placeholder: 'en',
				description: 'Language for the captions',
			},
			{
				displayName: 'Caption Style',
				name: 'captionStyle',
				type: 'string',
				default: '',
				placeholder: 'classic-yellow',
				description:
					'Caption preset used when captions are on, e.g. classic-yellow, bold-white, glow-pink, gaming-cyan',
			},
			{
				displayName: 'Enable Captions',
				name: 'enableCaption',
				type: 'boolean',
				default: false,
				description: 'Whether to burn captions into the clips',
			},
			{
				...idempotencyKeyOption,
			},
			{
				displayName: 'Max Clips',
				name: 'maxClips',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 20 },
				default: 10,
				description: 'Maximum number of clips to create (1–20)',
			},
			{
				displayName: 'Moments to Find',
				name: 'query',
				type: 'string',
				default: '',
				placeholder: 'funny reactions',
				description: 'Describe the moments the AI should look for (max 500 characters)',
			},
			{
				displayName: 'Video Language',
				name: 'sourceLang',
				type: 'string',
				default: '',
				placeholder: 'en',
				description: 'Language spoken in the video',
			},
		],
	},
	...waitForCompletionFields(RESOURCE, 'create', { pollIntervalSeconds: 15, timeoutMinutes: 30 }),

	// ----- get / getStatus / delete / deleteClip -----
	idParameter(
		RESOURCE,
		['get', 'getStatus', 'delete', 'deleteClip'],
		'Clipping ID',
		'clippingId',
		'ID of the clipping job',
	),
	idParameter(RESOURCE, ['deleteClip'], 'Clip ID', 'clipId', 'ID of the clip to delete'),

	// ----- getAll -----
	...returnAllAndLimit(RESOURCE),
];
