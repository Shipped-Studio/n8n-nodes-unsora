import type { INodeProperties } from 'n8n-workflow';
import {
	idParameter,
	idempotencyKeyOption,
	returnAllAndLimit,
	showFor,
	waitForCompletionFields,
} from '../../shared/descriptions';

const RESOURCE = 'voiceover';

export const voiceoverDescription: INodeProperties[] = [
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
				description: 'Turn a script into a voiceover',
				action: 'Create a voiceover',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a voiceover',
				action: 'Delete a voiceover',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List voiceovers',
				action: 'List voiceovers',
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				description: 'Get the status and audio URL of a voiceover',
				action: 'Get voiceover status',
			},
			{
				name: 'Get Voices',
				value: 'getVoices',
				description: 'List the available voices with preview clips',
				action: 'List voices',
			},
		],
		default: 'create',
	},

	// ----- create -----
	{
		displayName: 'Script',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 6 },
		required: true,
		default: '',
		description:
			'Text to speak (max 10,000 characters). Add &lt;#1.5#&gt; between words to pause for 1.5 seconds.',
		displayOptions: showFor(RESOURCE, ['create']),
	},
	{
		displayName: 'Voice Name or ID',
		name: 'voiceId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getVoices' },
		required: true,
		default: '',
		description:
			'Voice to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
				displayName: 'Similarity',
				name: 'similarity',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
				default: 1,
				description: 'How closely the output sticks to the base voice (0–1)',
			},
			{
				displayName: 'Stability',
				name: 'stability',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
				default: 0.5,
				description: 'Higher is more consistent, lower is more expressive (0–1)',
			},
		],
	},
	...waitForCompletionFields(RESOURCE, 'create', { pollIntervalSeconds: 10, timeoutMinutes: 10 }),

	// ----- getStatus / delete -----
	idParameter(
		RESOURCE,
		['getStatus', 'delete'],
		'Voiceover ID',
		'voiceoverId',
		'ID of the voiceover',
	),

	// ----- getAll -----
	...returnAllAndLimit(RESOURCE),
];
