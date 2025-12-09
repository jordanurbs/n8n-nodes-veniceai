import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IRequestOptions,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class VeniceImageUpscaleTool implements INodeType {
	description: INodeTypeDescription & { usableAsTool: boolean } = {
		displayName: 'Venice Image Upscale Tool',
		name: 'veniceImageUpscaleTool',
		icon: 'file:../VeniceAi/veniceai.svg',
		group: ['transform'],
		version: 1,
		description: 'Upscale and enhance images using Venice AI',
		defaults: {
			name: 'Venice Image Upscale',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.venice.ai/api-reference/endpoint/image/upscale',
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
				displayName: 'Binary Property',
				name: 'binaryProperty',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary property containing the image to upscale',
			},
			{
				displayName: 'Scale Factor',
				name: 'scale',
				type: 'options',
				default: 2,
				options: [
					{ name: '2x', value: 2 },
					{ name: '4x', value: 4 },
				],
				description: 'How much to upscale the image',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Enhance',
						name: 'enhance',
						type: 'boolean',
						default: false,
						description: 'Whether to enhance the upscaled image',
					},
					{
						displayName: 'Enhance Creativity',
						name: 'enhanceCreativity',
						type: 'number',
						default: 0.35,
						typeOptions: {
							minValue: 0,
							maxValue: 1,
						},
						description: 'Creativity level for enhancement (0-1)',
					},
					{
						displayName: 'Enhance Prompt',
						name: 'enhancePrompt',
						type: 'string',
						default: '',
						description: 'Optional prompt for enhancement direction',
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
				const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
				const scale = this.getNodeParameter('scale', i) as number;
				const options = this.getNodeParameter('options', i) as {
					enhance?: boolean;
					enhanceCreativity?: number;
					enhancePrompt?: string;
				};

				if (!items[i].binary) {
					throw new NodeOperationError(this.getNode(), 'No binary data exists on item!', {
						itemIndex: i,
					});
				}

				const binaryData = items[i].binary![binaryProperty];
				if (!binaryData) {
					throw new NodeOperationError(
						this.getNode(),
						`No binary data property "${binaryProperty}" exists on item!`,
						{ itemIndex: i },
					);
				}

				const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
				const fileName = binaryData.fileName || 'image';
				const mimeType = binaryData.mimeType || 'image/png';

				const formData: Record<string, unknown> = {
					scale: scale.toString(),
					image: {
						value: binaryDataBuffer,
						options: {
							filename: fileName,
							contentType: mimeType,
						},
					},
				};

				if (options.enhance !== undefined) {
					formData.enhance = options.enhance.toString();
				}
				if (options.enhanceCreativity !== undefined) {
					formData.enhanceCreativity = options.enhanceCreativity.toString();
				}
				if (options.enhancePrompt) {
					formData.prompt = options.enhancePrompt;
				}

				const requestOptions: IRequestOptions = {
					url: `${credentials.baseUrl || 'https://api.venice.ai/api/v1'}/image/upscale`,
					method: 'POST' as IHttpRequestMethods,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
					},
					formData: formData as IRequestOptions['formData'],
					encoding: null,
					resolveWithFullResponse: true,
				};

				const response = await this.helpers.request(requestOptions);
				const responseBody = response.body || Buffer.from([]);
				const responseMimeType = response.headers?.['content-type'] || 'image/png';

				const newItem: INodeExecutionData = {
					json: {
						success: true,
						scale,
						enhance: options.enhance || false,
					},
					binary: {
						data: await this.helpers.prepareBinaryData(
							responseBody,
							`upscaled_${fileName}`,
							responseMimeType,
						),
					},
					pairedItem: { item: i },
				};

				returnData.push(newItem);
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
