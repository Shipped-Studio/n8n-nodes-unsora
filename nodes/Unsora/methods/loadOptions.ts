import type { IDataObject, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { unsoraApiRequest } from '../shared/transport';
import { extractList, toList } from '../shared/utils';

const PROVIDER_LABELS: Record<string, string> = {
	google: 'YouTube',
	youtube: 'YouTube',
	tiktok: 'TikTok',
	instagram: 'Instagram',
	facebook: 'Facebook',
	pinterest: 'Pinterest',
	threads: 'Threads',
	bluesky: 'Bluesky',
	linkedin: 'LinkedIn',
	twitter: 'X',
	x: 'X',
	google_business: 'Google Business Profile',
	googlebusiness: 'Google Business Profile',
};

export function providerLabel(provider: unknown): string {
	const key = String(provider ?? '').toLowerCase();
	return PROVIDER_LABELS[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unknown');
}

export function accountOptionName(account: IDataObject): string {
	const name =
		(account.accountName as string | null) ||
		(account.accountUsername as string | null) ||
		String(account.id);
	return `${name} (${providerLabel(account.provider)})`;
}

async function fetchAccounts(this: ILoadOptionsFunctions): Promise<IDataObject[]> {
	const response = await unsoraApiRequest.call(this, 'GET', '/accounts');
	return extractList(response);
}

function toAccountOptions(accounts: IDataObject[]): INodePropertyOptions[] {
	return accounts
		.map((account) => ({
			name: accountOptionName(account),
			value: String(account.id),
			description: account.accountUsername ? `@${String(account.accountUsername)}` : undefined,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	return toAccountOptions(await fetchAccounts.call(this));
}

export async function getPinterestAccounts(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const accounts = await fetchAccounts.call(this);
	return toAccountOptions(
		accounts.filter((account) => String(account.provider).toLowerCase() === 'pinterest'),
	);
}

export async function getTiktokAccounts(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const accounts = await fetchAccounts.call(this);
	return toAccountOptions(
		accounts.filter((account) => String(account.provider).toLowerCase() === 'tiktok'),
	);
}

/** Boards of the Pinterest accounts selected in "Accounts" (or of every Pinterest account). */
export async function getPinterestBoards(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	let selected: string[] = [];
	try {
		selected = toList(this.getCurrentNodeParameter('accounts'));
	} catch {
		selected = [];
	}
	const accounts = (await fetchAccounts.call(this)).filter(
		(account) =>
			String(account.provider).toLowerCase() === 'pinterest' &&
			(selected.length === 0 || selected.includes(String(account.id))),
	);

	const options: INodePropertyOptions[] = [];
	for (const account of accounts) {
		const response = await unsoraApiRequest.call(
			this,
			'GET',
			`/accounts/${encodeURIComponent(String(account.id))}/pinterest/boards`,
		);
		for (const board of extractList(response)) {
			options.push({
				name:
					accounts.length > 1
						? `${String(board.name)} (${accountOptionName(account)})`
						: String(board.name),
				value: String(board.id),
				description: board.privacy ? `Privacy: ${String(board.privacy)}` : undefined,
			});
		}
	}
	return options.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getVoices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const response = await unsoraApiRequest.call(this, 'GET', '/voiceovers/voices');
	return extractList(response)
		.map((voice) => {
			const traits = [voice.gender, voice.accent].filter(Boolean).join(', ');
			return {
				name: traits
					? `${String(voice.label ?? voice.id)} (${traits})`
					: String(voice.label ?? voice.id),
				value: String(voice.id),
				description: voice.description ? String(voice.description) : undefined,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

async function getCatalogModels(
	this: ILoadOptionsFunctions,
	category: 'video' | 'image',
	defaultModel: { key: string; label: string },
): Promise<INodePropertyOptions[]> {
	const response = await unsoraApiRequest.call(this, 'GET', '/catalog', { qs: { category } });
	const options: INodePropertyOptions[] = extractList(response)
		.filter((model) => !model.category || model.category === category)
		.map((model) => ({
			name: String(model.label ?? model.key),
			value: String(model.key),
			description: [model.provider, model.description].filter(Boolean).join(' · ') || undefined,
		}));
	const known = new Set(options.map((option) => option.value));
	if (!known.has(defaultModel.key)) {
		options.unshift({ name: defaultModel.label, value: defaultModel.key });
	}
	return options;
}

export async function getVideoModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	return await getCatalogModels.call(this, 'video', { key: 'seedance-2.0', label: 'Seedance 2.0' });
}

export async function getImageModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	return await getCatalogModels.call(this, 'image', {
		key: 'nano-banana-2',
		label: 'Nano Banana 2',
	});
}
