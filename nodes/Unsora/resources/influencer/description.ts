import type { INodeProperties } from 'n8n-workflow';
import {
	idParameter,
	idempotencyKeyOption,
	returnAllAndLimit,
	showFor,
	waitForCompletionFields,
} from '../../shared/descriptions';

const RESOURCE = 'influencer';

export const influencerDescription: INodeProperties[] = [
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
				description: 'Generate photos of an AI influencer',
				action: 'Create influencer images',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an influencer image',
				action: 'Delete an influencer image',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List influencer images',
				action: 'List influencer images',
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
		description: 'Describe the scene, outfit, mood or action',
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
				displayName: 'Age',
				name: 'age',
				type: 'number',
				typeOptions: { minValue: 18, maxValue: 70 },
				default: 25,
				description: 'Age of the influencer (18–70)',
			},
			{
				displayName: 'Aspect Ratio',
				name: 'aspectRatio',
				type: 'options',
				options: [
					{ name: '1:1', value: '1:1' },
					{ name: '16:9', value: '16:9' },
					{ name: '3:4', value: '3:4' },
					{ name: '4:3', value: '4:3' },
					{ name: '9:16', value: '9:16' },
				],
				default: '1:1',
			},
			{
				displayName: 'Camera Angle',
				name: 'cameraAngle',
				type: 'options',
				options: [
					{ name: 'Close-Up', value: 'close-up' },
					{ name: 'Full Body', value: 'full-body' },
					{ name: 'Portrait', value: 'portrait' },
					{ name: 'POV', value: 'pov' },
					{ name: 'Side Profile', value: 'side-profile' },
				],
				default: 'portrait',
			},
			{
				displayName: 'Count',
				name: 'count',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 10 },
				default: 1,
				description: 'Number of images to generate (1–10)',
			},
			{
				...idempotencyKeyOption,
			},
			{
				displayName: 'Style',
				name: 'styleMode',
				type: 'options',
				options: [
					{ name: 'Beauty Close-Up', value: 'beauty_closeup' },
					{ name: 'Car Selfie', value: 'car_selfie' },
					{ name: 'Casual Daylight', value: 'casual_daylight' },
					{ name: 'Cinematic', value: 'cinematic' },
					{ name: 'Cozy Indoor', value: 'cozy_indoor' },
					{ name: 'Golden Hour', value: 'golden_hour' },
					{ name: 'Low Light Intimate', value: 'low_light_intimate' },
					{ name: 'Luxury Influencer', value: 'luxury_influencer' },
					{ name: 'Mirror Selfie', value: 'mirror_selfie' },
					{ name: 'Moody Night', value: 'moody_night' },
					{ name: 'Party Night Out', value: 'party_night_out' },
					{ name: 'Raw Flash', value: 'raw_flash' },
					{ name: 'Travel Content', value: 'travel_content' },
					{ name: 'UGC', value: 'ugc' },
				],
				default: 'ugc',
			},
		],
	},
	...waitForCompletionFields(RESOURCE, 'create', { pollIntervalSeconds: 10, timeoutMinutes: 10 }),

	// ----- delete -----
	idParameter(
		RESOURCE,
		['delete'],
		'Influencer Image ID',
		'influencerId',
		'ID of the influencer image',
	),

	// ----- getAll -----
	...returnAllAndLimit(RESOURCE),
];
