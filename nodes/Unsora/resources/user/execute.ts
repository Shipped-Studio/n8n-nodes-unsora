import type { OperationHandlers } from '../../shared/descriptions';
import { unsoraApiRequest } from '../../shared/transport';
import { unwrapData } from '../../shared/utils';

export const userOperations: OperationHandlers = {
	async getCredits(itemIndex) {
		return unwrapData(await unsoraApiRequest.call(this, 'GET', '/user/credits', { itemIndex }));
	},

	async getSubscription(itemIndex) {
		return unwrapData(
			await unsoraApiRequest.call(this, 'GET', '/user/subscription', { itemIndex }),
		);
	},
};
