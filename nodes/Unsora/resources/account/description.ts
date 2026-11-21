import type { INodeProperties } from 'n8n-workflow';
import { showFor } from '../../shared/descriptions';

const RESOURCE = 'account';

export const accountDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: showFor(RESOURCE),
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the social accounts connected to Unsora',
				action: 'List accounts',
			},
			{
				name: 'Get Pinterest Boards',
				value: 'getPinterestBoards',
				description: 'List the boards of a connected Pinterest account',
				action: 'List pinterest boards',
			},
			{
				name: 'Get TikTok Creator Info',
				value: 'getTiktokCreatorInfo',
				description: 'Get the posting options TikTok allows for a connected account',
				action: 'Get tiktok creator info',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Pinterest Account Name or ID',
		name: 'accountId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getPinterestAccounts' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: showFor(RESOURCE, ['getPinterestBoards']),
	},
	{
		displayName: 'TikTok Account Name or ID',
		name: 'accountId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTiktokAccounts' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: showFor(RESOURCE, ['getTiktokCreatorInfo']),
	},
];
