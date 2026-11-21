import type { INodeProperties } from 'n8n-workflow';
import type { OperationHandlers } from '../shared/descriptions';
import { accountDescription } from './account/description';
import { accountOperations } from './account/execute';
import { clippingDescription } from './clipping/description';
import { clippingOperations } from './clipping/execute';
import { imageDescription } from './image/description';
import { imageOperations } from './image/execute';
import { influencerDescription } from './influencer/description';
import { influencerOperations } from './influencer/execute';
import { musicDescription } from './music/description';
import { musicOperations } from './music/execute';
import { postDescription } from './post/description';
import { postOperations } from './post/execute';
import { thumbnailDescription } from './thumbnail/description';
import { thumbnailOperations } from './thumbnail/execute';
import { uploadDescription } from './upload/description';
import { uploadOperations } from './upload/execute';
import { userDescription } from './user/description';
import { userOperations } from './user/execute';
import { videoDescription } from './video/description';
import { videoOperations } from './video/execute';
import { voiceoverDescription } from './voiceover/description';
import { voiceoverOperations } from './voiceover/execute';

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Account', value: 'account', description: 'Connected social accounts' },
		{ name: 'AI Influencer', value: 'influencer', description: 'AI influencer photos' },
		{ name: 'Clipping', value: 'clipping', description: 'Turn long videos into short clips' },
		{ name: 'Image', value: 'image', description: 'AI image generation' },
		{ name: 'Music', value: 'music', description: 'AI music generation' },
		{ name: 'Post', value: 'post', description: 'Schedule and publish social posts' },
		{ name: 'Thumbnail', value: 'thumbnail', description: 'AI YouTube thumbnails' },
		{ name: 'Upload', value: 'upload', description: 'Media library uploads' },
		{ name: 'User', value: 'user', description: 'Credits and subscription' },
		{ name: 'Video', value: 'video', description: 'AI video generation' },
		{ name: 'Voiceover', value: 'voiceover', description: 'AI text-to-speech voiceovers' },
	],
	default: 'clipping',
};

export const resourceProperties: INodeProperties[] = [
	resourceProperty,
	...accountDescription,
	...clippingDescription,
	...imageDescription,
	...influencerDescription,
	...musicDescription,
	...postDescription,
	...thumbnailDescription,
	...uploadDescription,
	...userDescription,
	...videoDescription,
	...voiceoverDescription,
];

export const operationHandlers: Record<string, OperationHandlers> = {
	account: accountOperations,
	clipping: clippingOperations,
	image: imageOperations,
	influencer: influencerOperations,
	music: musicOperations,
	post: postOperations,
	thumbnail: thumbnailOperations,
	upload: uploadOperations,
	user: userOperations,
	video: videoOperations,
	voiceover: voiceoverOperations,
};
