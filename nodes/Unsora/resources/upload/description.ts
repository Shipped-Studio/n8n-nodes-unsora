import type { INodeProperties } from 'n8n-workflow';
import { idParameter, returnAllAndLimit, showFor } from '../../shared/descriptions';

const RESOURCE = 'upload';

const fileOptions: INodeProperties[] = [
	{
		displayName: 'Content Type',
		name: 'contentType',
		type: 'string',
		default: '',
		placeholder: 'video/mp4',
		description: 'MIME type override, e.g. video/mp4 or image/png',
	},
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		default: '',
		placeholder: 'my-video.mp4',
		description: 'Name to store the file under',
	},
];

export const uploadDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: showFor(RESOURCE),
		options: [
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an uploaded file',
				action: 'Delete an upload',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List uploaded files',
				action: 'List uploads',
			},
			{
				name: 'Upload File',
				value: 'uploadFile',
				description:
					'Upload a file from a binary property (files over 5 MB go straight to storage)',
				action: 'Upload a file',
			},
			{
				name: 'Upload From URL',
				value: 'createFromUrl',
				description: 'Import a file from a public URL (max 200 MB)',
				action: 'Upload from URL',
			},
		],
		default: 'createFromUrl',
	},

	// ----- createFromUrl -----
	{
		displayName: 'File URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/video.mp4',
		description: 'Public http(s) URL of the file to import',
		displayOptions: showFor(RESOURCE, ['createFromUrl']),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(RESOURCE, ['createFromUrl']),
		options: fileOptions,
	},

	// ----- uploadFile -----
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the input binary field containing the file to upload',
		description: 'Name of the binary property that holds the file',
		displayOptions: showFor(RESOURCE, ['uploadFile']),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: showFor(RESOURCE, ['uploadFile']),
		options: fileOptions,
	},

	// ----- delete -----
	idParameter(RESOURCE, ['delete'], 'Upload ID', 'uploadId', 'ID of the uploaded file'),

	// ----- getAll -----
	...returnAllAndLimit(RESOURCE),
];
