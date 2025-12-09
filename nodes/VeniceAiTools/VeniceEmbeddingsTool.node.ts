import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IRequestOptions,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class VeniceEmbeddingsTool implements INodeType {
	description: INodeTypeDescription & { usableAsTool: boolean } = {
		displayName: 'Venice Embeddings Tool',
		name: 'veniceEmbeddingsTool',
		icon: 'file:../VeniceAi/veniceai.svg',
		group: ['transform'],
		version: 1,
		description: 'Generate text embeddings for semantic search and RAG using Venice AI',
		defaults: {
			name: 'Venice Embeddings',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.venice.ai/api-reference/endpoint/embeddings',
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
				displayName: 'Text',
				name: 'input',
				type: 'string',
				required: true,
				default: '',
				description: 'The text to generate embeddings for',
				typeOptions: {
					rows: 4,
				},
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				default: 'text-embedding-bge-m3',
				options: [
					{ name: 'BGE-M3', value: 'text-embedding-bge-m3' },
					{ name: 'Ada 002', value: 'text-embedding-ada-002' },
				],
				description: 'The embedding model to use',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Encoding Format',
						name: 'encoding_format',
						type: 'options',
						default: 'float',
						options: [
							{ name: 'Float', value: 'float' },
							{ name: 'Base64', value: 'base64' },
						],
						description: 'The format to return embeddings in',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('veniceAiApi');

		for (let i = 0; i < items.length; i++) {
			try {
				const input = this.getNodeParameter('input', i) as string;
				const model = this.getNodeParameter('model', i) as string;
				const options = this.getNodeParameter('options', i) as {
					encoding_format?: string;
				};

				const requestOptions: IRequestOptions = {
					url: `${credentials.baseUrl || 'https://api.venice.ai/api/v1'}/embeddings`,
					method: 'POST' as IHttpRequestMethods,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
					body: {
						model,
						input,
						encoding_format: options.encoding_format || 'float',
					},
					json: true,
				};

				const response = await this.helpers.request(requestOptions);

				returnData.push({
					json: {
						success: true,
						model,
						inputLength: input.length,
						...response,
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
