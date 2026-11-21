import type { INodeProperties } from 'n8n-workflow';
import {
	idParameter,
	idempotencyKeyOption,
	returnAllAndLimit,
	showFor,
	waitForCompletionFields,
} from '../../shared/descriptions';

const RESOURCE = 'thumbnail';

export const thumbnailDescription: INodeProperties[] = [
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
				description: 'Generate YouTube thumbnails with AI',
				action: 'Create a thumbnail',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a thumbnail generation',
				action: 'Delete a thumbnail',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a thumbnail generation',
				action: 'Get a thumbnail',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List thumbnail generations',
				action: 'List thumbnails',
			},
		],
		default: 'create',
	},

	// ----- create -----
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		placeholder: 'I tried every AI video tool so you do not have to',
		description: 'Title or idea for the thumbnail',
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
				displayName: 'Document URL',
				name: 'documentUrl',
				type: 'string',
				default: '',
				description:
					'Public PDF URL to use as context. Use either this or YouTube Video URL, not both.',
			},
			{
				displayName: 'Expression',
				name: 'expression',
				type: 'options',
				options: [
					{ name: 'Angry', value: 'angry' },
					{ name: 'Auto', value: 'auto' },
					{ name: 'Big Smile', value: 'big-smile' },
					{ name: 'Confused', value: 'confused' },
					{ name: 'Determined', value: 'determined' },
					{ name: 'Disgusted', value: 'disgusted' },
					{ name: 'Neutral', value: 'neutral' },
					{ name: 'Sad', value: 'sad' },
					{ name: 'Soft Smile', value: 'soft-smile' },
					{ name: 'Surprised', value: 'surprised' },
					{ name: 'Worried', value: 'worried' },
				],
				default: 'auto',
				description: 'Facial expression for the person in the thumbnail',
			},
			{
				...idempotencyKeyOption,
			},
			{
				displayName: 'Reference Image URLs',
				name: 'referenceImageUrls',
				type: 'string',
				default: '',
				description:
					"Comma-separated reference images, such as the creator's face (up to 16 including the template)",
			},
			{
				displayName: 'Template Image URL',
				name: 'templateImageUrl',
				type: 'string',
				default: '',
				description: 'One layout template image to follow',
			},
			{
				displayName: 'Variations',
				name: 'variations',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 20 },
				default: 1,
				description: 'Number of thumbnails to generate (1–20)',
			},
			{
				displayName: 'YouTube Video URL',
				name: 'youtubeUrl',
				type: 'string',
				default: '',
				description: 'YouTube video to use as context (its title and transcript are read)',
			},
		],
	},
	...waitForCompletionFields(RESOURCE, 'create', { pollIntervalSeconds: 10, timeoutMinutes: 10 }),

	// ----- get / delete -----
	idParameter(
		RESOURCE,
		['get', 'delete'],
		'Thumbnail ID',
		'thumbnailId',
		'ID of the thumbnail generation',
	),

	// ----- getAll -----
	...returnAllAndLimit(RESOURCE),
];
