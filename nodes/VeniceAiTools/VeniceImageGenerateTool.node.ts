import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IRequestOptions,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class VeniceImageGenerateTool implements INodeType {
	description: INodeTypeDescription & { usableAsTool: boolean } = {
		displayName: 'Venice Image Generate Tool',
		name: 'veniceImageGenerateTool',
		icon: 'file:../VeniceAi/veniceai.svg',
		group: ['transform'],
		version: 1,
		description: 'Generate images from text prompts using Venice AI',
		defaults: {
			name: 'Venice Image Generate',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.venice.ai/api-reference/endpoint/image/generate',
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
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				required: true,
				default: '',
				description: 'The text prompt to generate an image from',
				typeOptions: {
					rows: 4,
				},
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				default: 'fluently-xl',
				options: [
					{ name: 'Fluently XL', value: 'fluently-xl' },
					{ name: 'Flux Dev', value: 'flux-dev' },
					{ name: 'Flux Dev Uncensored', value: 'flux-dev-uncensored' },
					{ name: 'Flux Schnell', value: 'flux-schnell' },
					{ name: 'HiDream', value: 'hidream' },
					{ name: 'Stable Diffusion 3.5', value: 'stable-diffusion-3.5' },
					{ name: 'Lustify', value: 'lustify' },
					{ name: 'Pony Realism', value: 'pony-realism' },
				],
				description: 'The model to use for image generation',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Width',
						name: 'width',
						type: 'number',
						default: 1024,
						description: 'Width of the generated image in pixels',
					},
					{
						displayName: 'Height',
						name: 'height',
						type: 'number',
						default: 1024,
						description: 'Height of the generated image in pixels',
					},
					{
						displayName: 'Steps',
						name: 'steps',
						type: 'number',
						default: 20,
						description: 'Number of inference steps',
					},
					{
						displayName: 'CFG Scale',
						name: 'cfg_scale',
						type: 'number',
						default: 7.5,
						description: 'Classifier-free guidance scale',
					},
					{
						displayName: 'Negative Prompt',
						name: 'negative_prompt',
						type: 'string',
						default: '',
						description: 'What to avoid in the generated image',
					},
					{
						displayName: 'Style Preset',
						name: 'style_preset',
						type: 'options',
						default: '',
						options: [
							{ name: 'None', value: '' },
							{ name: '3D Model', value: '3D Model' },
							{ name: 'Analog Film', value: 'Analog Film' },
							{ name: 'Anime', value: 'Anime' },
							{ name: 'Cinematic', value: 'Cinematic' },
							{ name: 'Comic Book', value: 'Comic Book' },
							{ name: 'Digital Art', value: 'Digital Art' },
							{ name: 'Fantasy Art', value: 'Fantasy Art' },
							{ name: 'Photographic', value: 'Photographic' },
							{ name: 'Pixel Art', value: 'Pixel Art' },
						],
						description: 'Style preset for the generated image',
					},
					{
						displayName: 'Seed',
						name: 'seed',
						type: 'number',
						default: 0,
						description: 'Random seed (0 for random)',
					},
					{
						displayName: 'Hide Watermark',
						name: 'hide_watermark',
						type: 'boolean',
						default: false,
						description: 'Whether to hide the Venice watermark',
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
				const prompt = this.getNodeParameter('prompt', i) as string;
				const model = this.getNodeParameter('model', i) as string;
				const options = this.getNodeParameter('options', i) as {
					width?: number;
					height?: number;
					steps?: number;
					cfg_scale?: number;
					negative_prompt?: string;
					style_preset?: string;
					seed?: number;
					hide_watermark?: boolean;
				};

				const body: Record<string, unknown> = {
					model,
					prompt,
					...options,
				};

				// Remove empty values
				Object.keys(body).forEach((key) => {
					if (body[key] === '' || body[key] === undefined) {
						delete body[key];
					}
				});

				const requestOptions: IRequestOptions = {
					url: `${credentials.baseUrl || 'https://api.venice.ai/api/v1'}/image/generate`,
					method: 'POST' as IHttpRequestMethods,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
					body,
					json: true,
				};

				const response = await this.helpers.request(requestOptions);

				returnData.push({
					json: {
						success: true,
						model,
						prompt,
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
