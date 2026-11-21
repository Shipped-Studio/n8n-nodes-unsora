import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
	getAccounts,
	getImageModels,
	getPinterestAccounts,
	getPinterestBoards,
	getTiktokAccounts,
	getVideoModels,
	getVoices,
} from './methods/loadOptions';
import { operationHandlers, resourceProperties } from './resources';

export class Unsora implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Unsora',
		name: 'unsora',
		icon: { light: 'file:../../icons/unsora.svg', dark: 'file:../../icons/unsora.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Schedule and publish posts to every social network, with AI that turns long videos into clips and creates video, images, music and voiceovers',
		defaults: {
			name: 'Unsora',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'unsoraApi',
				required: true,
			},
		],
		properties: resourceProperties,
	};

	methods = {
		loadOptions: {
			getAccounts,
			getImageModels,
			getPinterestAccounts,
			getPinterestBoards,
			getTiktokAccounts,
			getVideoModels,
			getVoices,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const handler = operationHandlers[resource]?.[operation];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for resource "${resource}"`,
						{ itemIndex: i },
					);
				}

				const result = await handler.call(this, i);
				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(result),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
