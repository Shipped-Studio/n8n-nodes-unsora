import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class UnsoraApi implements ICredentialType {
	name = 'unsoraApi';

	displayName = 'Unsora API';

	icon: Icon = { light: 'file:../icons/unsora.svg', dark: 'file:../icons/unsora.dark.svg' };

	documentationUrl =
		'https://github.com/Shipped-Studio/n8n-nodes-unsora?tab=readme-ov-file#credentials';

	// Lets the HTTP Request node reuse this credential for custom Unsora API calls.
	httpRequestNode = {
		name: 'Unsora',
		docsUrl: 'https://tryunsora.com/docs',
		apiBaseUrl: 'https://mvp.tryunsora.com/api/v1',
		hidden: true,
	};

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'uns_...',
			description:
				'Your Unsora API key. Create one at <a href="https://app.tryunsora.com/api-keys" target="_blank">app.tryunsora.com/api-keys</a>.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://mvp.tryunsora.com/api/v1',
			description: 'Only change this if Unsora support asked you to use a different API endpoint',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
				Accept: 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/user/credits',
			method: 'GET',
		},
	};
}
