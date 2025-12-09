import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IRequestOptions,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class VeniceListModelsTool implements INodeType {
	description: INodeTypeDescription & { usableAsTool: boolean } = {
		displayName: 'Venice List Models Tool',
		name: 'veniceListModelsTool',
		icon: 'file:../VeniceAi/veniceai.svg',
		group: ['transform'],
		version: 1,
		description: 'List available Venice AI models by type',
		defaults: {
			name: 'Venice List Models',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.venice.ai/api-reference/endpoint/models',
					},
				],
			},
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'veniceAiApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Type Filter',
				name: 'type',
				type: 'options',
				default: 'all',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Text/Chat', value: 'text' },
					{ name: 'Image', value: 'image' },
					{ name: 'Embedding', value: 'embedding' },
					{ name: 'TTS (Text-to-Speech)', value: 'tts' },
					{ name: 'ASR (Speech-to-Text)', value: 'asr' },
					{ name: 'Upscale', value: 'upscale' },
				],
				description: 'Filter models by type',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('veniceAiApi');

		for (let i = 0; i < items.length; i++) {
			try {
				const type = this.getNodeParameter('type', i) as string;

				const requestOptions: IRequestOptions = {
					url: `${credentials.baseUrl || 'https://api.venice.ai/api/v1'}/models`,
					method: 'GET' as IHttpRequestMethods,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
					},
					qs: type !== 'all' ? { type } : {},
					json: true,
				};

				const response = await this.helpers.request(requestOptions);

				// Format the models list for easier consumption
				const models = response.data || [];
				const formattedModels = models.map((model: {
					id: string;
					type?: string;
					object?: string;
					created?: number;
				}) => ({
					id: model.id,
					type: model.type,
					object: model.object,
					created: model.created,
				}));

				returnData.push({
					json: {
						success: true,
						filter: type,
						count: formattedModels.length,
						models: formattedModels,
					},
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
