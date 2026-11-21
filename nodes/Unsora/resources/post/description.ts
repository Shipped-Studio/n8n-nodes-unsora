import type { INodeProperties } from 'n8n-workflow';
import {
	idParameter,
	idempotencyKeyOption,
	returnAllAndLimit,
	showFor,
} from '../../shared/descriptions';

const RESOURCE = 'post';

const POST_STATUSES = [
	{ name: 'Draft', value: 'DRAFT' },
	{ name: 'Failed', value: 'FAILED' },
	{ name: 'Partially Published', value: 'PARTIALLY_PUBLISHED' },
	{ name: 'Published', value: 'PUBLISHED' },
	{ name: 'Publishing', value: 'PUBLISHING' },
	{ name: 'Scheduled', value: 'SCHEDULED' },
];

const POST_TYPES = [
	{ name: 'Carousel', value: 'CAROUSEL' },
	{ name: 'Image', value: 'IMAGE' },
	{ name: 'Text', value: 'TEXT' },
	{ name: 'Video', value: 'VIDEO' },
];

export const postDescription: INodeProperties[] = [
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
				description: 'Schedule, publish or draft a post on one or more social accounts',
				action: 'Create a post',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a post',
				action: 'Delete a post',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a post with its per-account results',
				action: 'Get a post',
			},
			{
				name: 'Get Analytics',
				value: 'getAnalytics',
				description: 'Get a summary of views, likes, comments and shares',
				action: 'Get post analytics',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List posts',
				action: 'List posts',
			},
			{
				name: 'Publish Now',
				value: 'publish',
				description: 'Publish a draft or scheduled post immediately',
				action: 'Publish a post now',
			},
			{
				name: 'Retry',
				value: 'retry',
				description: 'Publish again to the accounts that failed',
				action: 'Retry a post',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Change the caption, schedule or accounts of a post',
				action: 'Update a post',
			},
		],
		default: 'create',
	},

	// ----- create -----
	{
		displayName: 'Account Names or IDs',
		name: 'accounts',
		type: 'multiOptions',
		typeOptions: { loadOptionsMethod: 'getAccounts' },
		required: true,
		default: [],
		description:
			'Social accounts to post to (max 10, platforms can be mixed). Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: showFor(RESOURCE, ['create']),
	},
	{
		displayName: 'Caption',
		name: 'caption',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		description: 'Post text, used for every account without its own caption',
		displayOptions: showFor(RESOURCE, ['create']),
	},
	{
		displayName: 'Media Type',
		name: 'mediaType',
		type: 'options',
		options: [
			{ name: 'Video', value: 'video', description: 'One video (Reel, Short, TikTok, ...)' },
			{ name: 'Images', value: 'images', description: 'One image, or several as a carousel' },
			{ name: 'None (Text Only)', value: 'none', description: 'A text post without media' },
		],
		default: 'video',
		displayOptions: showFor(RESOURCE, ['create']),
	},
	{
		displayName: 'Video URL',
		name: 'videoUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://...',
		description:
			'Public URL of the video file, e.g. a clip URL from a clipping or the URL returned by an upload',
		displayOptions: {
			show: { resource: [RESOURCE], operation: ['create'], mediaType: ['video'] },
		},
	},
	{
		displayName: 'Image URLs',
		name: 'imageUrls',
		type: 'string',
		typeOptions: { rows: 3 },
		required: true,
		default: '',
		description: 'Public image URLs in display order, separated by commas or new lines (max 35)',
		displayOptions: {
			show: { resource: [RESOURCE], operation: ['create'], mediaType: ['images'] },
		},
	},
	{
		displayName: 'When to Publish',
		name: 'publishMode',
		type: 'options',
		options: [
			{ name: 'Schedule', value: 'schedule', description: 'Publish at a set date and time' },
			{ name: 'Publish Now', value: 'now', description: 'Start publishing immediately' },
			{ name: 'Save as Draft', value: 'draft', description: 'Save without scheduling' },
		],
		default: 'schedule',
		displayOptions: showFor(RESOURCE, ['create']),
	},
	{
		displayName: 'Schedule At',
		name: 'scheduledAt',
		type: 'dateTime',
		required: true,
		default: '',
		description:
			"When to publish (at least 2 minutes in the future). Values without a time zone use the workflow's time zone.",
		displayOptions: {
			show: { resource: [RESOURCE], operation: ['create'], publishMode: ['schedule'] },
		},
	},
	{
		displayName: 'Per-Account Overrides',
		name: 'accountOverrides',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Override',
		default: {},
		description: 'Use a different caption or title for specific accounts',
		displayOptions: showFor(RESOURCE, ['create']),
		options: [
			{
				displayName: 'Override',
				name: 'override',
				values: [
					{
						displayName: 'Account Name or ID',
						name: 'accountId',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getAccounts' },
						default: '',
						description:
							'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
					},
					{
						displayName: 'Custom Caption',
						name: 'customCaption',
						type: 'string',
						typeOptions: { rows: 3 },
						default: '',
						description: 'Caption for this account only',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description:
							'Video title, used by YouTube. Defaults to the first 100 characters of the caption.',
					},
				],
			},
		],
	},
	{
		displayName: 'Platform Options',
		name: 'platformSettings',
		type: 'fixedCollection',
		placeholder: 'Add Platform Options',
		default: {},
		description: 'Options applied only to accounts on that platform',
		displayOptions: showFor(RESOURCE, ['create']),
		options: [
			{
				displayName: 'Google Business Profile',
				name: 'googleBusiness',
				values: [
					{
						displayName: 'Button',
						name: 'ctaType',
						type: 'options',
						options: [
							{ name: 'Book', value: 'BOOK' },
							{ name: 'Call', value: 'CALL' },
							{ name: 'Learn More', value: 'LEARN_MORE' },
							{ name: 'None', value: '' },
							{ name: 'Order', value: 'ORDER' },
							{ name: 'Shop', value: 'SHOP' },
							{ name: 'Sign Up', value: 'SIGN_UP' },
						],
						default: '',
						description: 'Call-to-action button shown on the post',
					},
					{
						displayName: 'Button URL',
						name: 'ctaUrl',
						type: 'string',
						default: '',
						description: 'Link the button opens. Required for every button except Call.',
					},
				],
			},
			{
				displayName: 'Instagram',
				name: 'instagram',
				values: [
					{
						displayName: 'Reel Cover URL',
						name: 'coverUrl',
						type: 'string',
						default: '',
						description:
							'Cover image for video posts. Without one, Instagram uses the frame at 5 seconds.',
					},
				],
			},
			{
				displayName: 'Pinterest',
				name: 'pinterest',
				values: [
					{
						displayName: 'Board Name or ID',
						name: 'boardId',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getPinterestBoards',
							loadOptionsDependsOn: ['accounts'],
						},
						default: '',
						description:
							'Board to pin to. Defaults to the account\'s first board. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Destination Link',
						name: 'link',
						type: 'string',
						default: '',
						description: 'Link opened when the pin is clicked',
					},
					{
						displayName: 'Pin Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'Pin title (max 100 characters). Defaults to the start of the caption.',
					},
				],
			},
			{
				displayName: 'TikTok',
				name: 'tiktok',
				values: [
					{
						displayName: 'AI-Generated Content',
						name: 'isAigc',
						type: 'boolean',
						default: false,
						description: 'Whether to label the post as AI-generated content',
					},
					{
						displayName: 'Auto Add Music',
						name: 'autoAddMusic',
						type: 'boolean',
						default: false,
						description: 'Whether TikTok may add background music (photo posts only)',
					},
					{
						displayName: 'Branded Content',
						name: 'brandContentToggle',
						type: 'boolean',
						default: false,
						description: 'Whether the post is a paid partnership promoting a third-party brand',
					},
					{
						displayName: 'Disable Comments',
						name: 'disableComment',
						type: 'boolean',
						default: false,
						description: 'Whether to turn off comments',
					},
					{
						displayName: 'Disable Duet',
						name: 'disableDuet',
						type: 'boolean',
						default: false,
						description: 'Whether to turn off duets (video posts only)',
					},
					{
						displayName: 'Disable Stitch',
						name: 'disableStitch',
						type: 'boolean',
						default: false,
						description: 'Whether to turn off stitches (video posts only)',
					},
					{
						displayName: 'Photo Cover Index',
						name: 'photoCoverIndex',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 0,
						description: 'Zero-based index of the cover image (photo posts only)',
					},
					{
						displayName: 'Photo Post Mode',
						name: 'postMode',
						type: 'options',
						options: [
							{ name: 'Direct Post', value: 'DIRECT_POST' },
							{ name: 'Send to TikTok Inbox', value: 'MEDIA_UPLOAD' },
						],
						default: 'DIRECT_POST',
						description:
							'Publish directly, or send to the TikTok inbox to finish in the app (photo posts only)',
					},
					{
						displayName: 'Privacy Level',
						name: 'privacyLevel',
						type: 'options',
						options: [
							{ name: 'Followers', value: 'FOLLOWER_OF_CREATOR' },
							{ name: 'Friends', value: 'MUTUAL_FOLLOW_FRIENDS' },
							{ name: 'Only Me', value: 'SELF_ONLY' },
							{ name: 'Public', value: 'PUBLIC_TO_EVERYONE' },
						],
						default: 'PUBLIC_TO_EVERYONE',
						description: 'Who can view the post. Must be an option TikTok allows for the account.',
					},
					{
						displayName: 'Promotes Own Business',
						name: 'brandOrganicToggle',
						type: 'boolean',
						default: false,
						description: "Whether the post promotes the creator's own business",
					},
					{
						displayName: 'Video Cover Time (Ms)',
						name: 'videoCoverTimestampMs',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 1000,
						description:
							'Frame used as the cover, in milliseconds from the start (video posts only)',
					},
				],
			},
			{
				displayName: 'YouTube',
				name: 'youtube',
				values: [
					{
						displayName: 'Category ID',
						name: 'categoryId',
						type: 'string',
						default: '22',
						description: 'YouTube category ID (22 is People & Blogs)',
					},
					{
						displayName: 'Made for Kids',
						name: 'madeForKids',
						type: 'boolean',
						default: false,
						description: 'Whether the video is made for kids',
					},
					{
						displayName: 'Privacy',
						name: 'privacyStatus',
						type: 'options',
						options: [
							{ name: 'Private', value: 'private' },
							{ name: 'Public', value: 'public' },
							{ name: 'Unlisted', value: 'unlisted' },
						],
						default: 'public',
					},
					{
						displayName: 'Tags',
						name: 'tags',
						type: 'string',
						default: '',
						description: 'Comma-separated video tags',
					},
				],
			},
		],
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
				displayName: 'Additional Body (JSON)',
				name: 'additionalBody',
				type: 'json',
				default: '{}',
				description:
					'Extra fields merged into the request body as-is, for API options not covered above',
			},
			{
				displayName: 'External ID',
				name: 'externalId',
				type: 'string',
				default: '',
				description:
					'Your own identifier for this request. Without an Idempotency Key it is used to prevent duplicates.',
			},
			{
				...idempotencyKeyOption,
			},
			{
				displayName: 'Post Type',
				name: 'type',
				type: 'options',
				options: POST_TYPES,
				default: 'VIDEO',
				description: 'Overrides the post type inferred from the media',
			},
			{
				displayName: 'Time Zone',
				name: 'timezone',
				type: 'string',
				default: '',
				placeholder: 'Europe/Berlin',
				description:
					"IANA time zone stored with the schedule for display. Defaults to the workflow's time zone.",
			},
			{
				displayName: 'Video Cover URL',
				name: 'coverUrl',
				type: 'string',
				default: '',
				description: 'Cover image for the video, also used as the Instagram Reel cover',
			},
		],
	},

	// ----- get / update / publish / retry / delete -----
	idParameter(
		RESOURCE,
		['get', 'update', 'publish', 'retry', 'delete'],
		'Post ID',
		'postId',
		'ID of the post',
	),

	// ----- update -----
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(RESOURCE, ['update']),
		options: [
			{
				displayName: 'Account Names or IDs',
				name: 'accounts',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getAccounts' },
				default: [],
				description:
					'Replaces the account list. Accounts that already published are kept. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'New caption',
			},
			{
				displayName: 'Clear Schedule',
				name: 'clearSchedule',
				type: 'boolean',
				default: false,
				description: 'Whether to remove the schedule and move the post back to draft',
			},
			{
				displayName: 'Schedule At',
				name: 'scheduledAt',
				type: 'dateTime',
				default: '',
				description:
					"New publish date and time. Values without a time zone use the workflow's time zone.",
			},
			{
				displayName: 'Time Zone',
				name: 'timezone',
				type: 'string',
				default: '',
				placeholder: 'Europe/Berlin',
				description: 'IANA time zone stored with the schedule',
			},
		],
	},

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
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: POST_STATUSES,
				default: 'SCHEDULED',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: POST_TYPES,
				default: 'VIDEO',
			},
		],
	},

	// ----- getAnalytics -----
	{
		displayName: 'Days',
		name: 'days',
		type: 'number',
		typeOptions: { minValue: 7, maxValue: 90 },
		default: 30,
		description: 'Size of the reporting window in days (7–90)',
		displayOptions: showFor(RESOURCE, ['getAnalytics']),
	},
];
