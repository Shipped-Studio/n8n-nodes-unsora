import { describe, expect, it } from 'vitest';
import {
	getAccounts,
	getPinterestBoards,
	getVideoModels,
	getVoices,
} from '../nodes/Unsora/methods/loadOptions';
import { BASE_URL, createLoadOptionsContext } from './helpers';

const accounts = {
	body: {
		success: true,
		data: [
			{ id: 'a1', provider: 'tiktok', accountName: 'Studio', accountUsername: 'studio' },
			{ id: 'a2', provider: 'google', accountName: null, accountUsername: 'studio-yt' },
			{ id: 'a3', provider: 'pinterest', accountName: 'Pins', accountUsername: null },
		],
	},
};

describe('loadOptions', () => {
	it('labels accounts as "name (platform)"', async () => {
		const { context } = createLoadOptionsContext([accounts]);
		const options = await getAccounts.call(context);
		expect(options.map((o) => [o.name, o.value])).toEqual([
			['Pins (Pinterest)', 'a3'],
			['Studio (TikTok)', 'a1'],
			['studio-yt (YouTube)', 'a2'],
		]);
	});

	it('lists boards of the selected Pinterest accounts', async () => {
		const { context, requests } = createLoadOptionsContext(
			[
				accounts,
				{ body: { success: true, data: [{ id: 'b1', name: 'Recipes', privacy: 'PUBLIC' }] } },
			],
			{ accounts: ['a1', 'a3'] },
		);
		const options = await getPinterestBoards.call(context);
		expect(requests[1].url).toBe(`${BASE_URL}/accounts/a3/pinterest/boards`);
		expect(options).toEqual([{ name: 'Recipes', value: 'b1', description: 'Privacy: PUBLIC' }]);
	});

	it('lists voices with gender and accent', async () => {
		const { context } = createLoadOptionsContext([
			{
				body: {
					success: true,
					voices: [
						{
							id: 'Aria',
							label: 'Aria',
							gender: 'female',
							accent: 'American',
							description: 'Warm',
						},
					],
				},
			},
		]);
		expect(await getVoices.call(context)).toEqual([
			{ name: 'Aria (female, American)', value: 'Aria', description: 'Warm' },
		]);
	});

	it('loads video models from the catalog and keeps the default model available', async () => {
		const { context, requests } = createLoadOptionsContext([
			{
				body: {
					success: true,
					models: [
						{ key: 'veo-3.1-fast', label: 'Veo 3.1 Fast', provider: 'Google', category: 'video' },
					],
				},
			},
		]);
		const options = await getVideoModels.call(context);
		expect(requests[0].qs).toEqual({ category: 'video' });
		expect(options.map((o) => o.value)).toEqual(['seedance-2.0', 'veo-3.1-fast']);
	});
});
