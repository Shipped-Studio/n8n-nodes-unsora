import type { INodeProperties } from 'n8n-workflow';
import { showFor } from '../../shared/descriptions';

export const userDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: showFor('user'),
		options: [
			{
				name: 'Get Credits',
				value: 'getCredits',
				description: 'Get the current credit balance',
				action: 'Get credits',
			},
			{
				name: 'Get Subscription',
				value: 'getSubscription',
				description: 'Get the current plan and subscription state',
				action: 'Get subscription',
			},
		],
		default: 'getCredits',
	},
];
