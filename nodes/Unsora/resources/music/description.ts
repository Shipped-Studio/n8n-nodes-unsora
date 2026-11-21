import type { INodeProperties } from 'n8n-workflow';
import {
	idParameter,
	idempotencyKeyOption,
	returnAllAndLimit,
	showFor,
	waitForCompletionFields,
} from '../../shared/descriptions';

const RESOURCE = 'music';

export const musicDescription: INodeProperties[] = [
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
				description: 'Generate a song or instrumental track with AI',
				action: 'Create music',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a music generation',
				action: 'Delete music',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List music generations',
				action: 'List music',
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				description: 'Get the status and output URL of a music generation',
				action: 'Get music status',
			},
		],
		default: 'create',
	},

	// ----- create -----
	{
		displayName: 'Style Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		placeholder: 'Upbeat synth-pop, female vocals, summer vibe',
		description: 'Genre, mood and vocal style (up to 1024 characters). Required for instrumentals.',
		displayOptions: showFor(RESOURCE, ['create']),
	},
	{
		displayName: 'Lyrics',
		name: 'lyrics',
		type: 'string',
		typeOptions: { rows: 6 },
		default: '',
		description:
			'Song lyrics (up to 3000 characters). Required unless Model is "Mureka 7.5 (Instrumental)", which makes background music without vocals and ignores lyrics.',
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
				...idempotencyKeyOption,
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: [
					{ name: 'Auto', value: 'auto' },
					{ name: 'Mureka 7.5 (Instrumental)', value: 'mureka-7.5' },
					{ name: 'Mureka 7.6', value: 'mureka-7.6' },
					{ name: 'Mureka 8', value: 'mureka-8' },
					{ name: 'Mureka 9', value: 'mureka-9' },
					{ name: 'Mureka O2', value: 'mureka-o2' },
				],
				default: 'auto',
				description:
					'Music model to use. All models except Mureka 7.5 (Instrumental) make songs and need lyrics.',
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				options: [
					{ name: 'FLAC', value: 'flac' },
					{ name: 'MP3', value: 'mp3' },
					{ name: 'WAV', value: 'wav' },
				],
				default: 'mp3',
				description: 'Audio file format',
			},
		],
	},
	...waitForCompletionFields(RESOURCE, 'create', { pollIntervalSeconds: 10, timeoutMinutes: 10 }),

	// ----- getStatus / delete -----
	idParameter(
		RESOURCE,
		['getStatus', 'delete'],
		'Music ID',
		'musicId',
		'ID of the music generation',
	),

	// ----- getAll -----
	...returnAllAndLimit(RESOURCE),
];
