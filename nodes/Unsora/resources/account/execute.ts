import type { IExecuteFunctions } from 'n8n-workflow';
import type { OperationHandlers } from '../../shared/descriptions';
import { unsoraApiRequest } from '../../shared/transport';
import { extractList, unwrapData } from '../../shared/utils';

function accountPath(this: IExecuteFunctions, itemIndex: number, suffix: string): string {
	const accountId = this.getNodeParameter('accountId', itemIndex) as string;
	return `/accounts/${encodeURIComponent(accountId)}${suffix}`;
}

export const accountOperations: OperationHandlers = {
	async getAll(itemIndex) {
		const response = await unsoraApiRequest.call(this, 'GET', '/accounts', { itemIndex });
		return extractList(response);
	},

	async getPinterestBoards(itemIndex) {
		const path = accountPath.call(this, itemIndex, '/pinterest/boards');
		const response = await unsoraApiRequest.call(this, 'GET', path, { itemIndex });
		return extractList(response);
	},

	async getTiktokCreatorInfo(itemIndex) {
		const path = accountPath.call(this, itemIndex, '/tiktok/creator-info');
		const response = await unsoraApiRequest.call(this, 'GET', path, { itemIndex });
		return unwrapData(response);
	},
};
