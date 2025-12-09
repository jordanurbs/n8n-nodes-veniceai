import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IRequestOptions,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class VeniceListCharactersTool implements INodeType {
	description: INodeTypeDescription & { usableAsTool: boolean } = {
		displayName: 'Venice List Characters Tool',
		name: 'veniceListCharactersTool',
		icon: 'file:../VeniceAi/veniceai.svg',
		group: ['transform'],
		version: 1,
		description: 'List available Venice AI character personas for roleplay',
		defaults: {
			name: 'Venice List Characters',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.venice.ai/api-reference/endpoint/characters',
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
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 20,
				description: 'Maximum number of characters to return',
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('veniceAiApi');

		for (let i = 0; i < items.length; i++) {
			try {
				const limit = this.getNodeParameter('limit', i) as number;

				const requestOptions: IRequestOptions = {
					url: `${credentials.baseUrl || 'https://api.venice.ai/api/v1'}/characters`,
					method: 'GET' as IHttpRequestMethods,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
					},
					qs: {
						limit,
					},
					json: true,
				};

				const response = await this.helpers.request(requestOptions);

				// Format the characters list for easier consumption
				const characters = response.data || response || [];
				const formattedCharacters = Array.isArray(characters)
					? characters.map((char: {
							id: string;
							name?: string;
							description?: string;
							slug?: string;
							avatar_url?: string;
					  }) => ({
							id: char.id,
							name: char.name,
							description: char.description,
							slug: char.slug,
							avatar_url: char.avatar_url,
					  }))
					: [];

				returnData.push({
					json: {
						success: true,
						count: formattedCharacters.length,
						characters: formattedCharacters,
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
