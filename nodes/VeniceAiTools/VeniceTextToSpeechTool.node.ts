import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IRequestOptions,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class VeniceTextToSpeechTool implements INodeType {
	description: INodeTypeDescription & { usableAsTool: boolean } = {
		displayName: 'Venice Text to Speech Tool',
		name: 'veniceTextToSpeechTool',
		icon: 'file:../VeniceAi/veniceai.svg',
		group: ['transform'],
		version: 1,
		description: 'Convert text to speech audio using Venice AI',
		defaults: {
			name: 'Venice Text to Speech',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.venice.ai/api-reference/endpoint/audio/speech',
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
				name: 'text',
				type: 'string',
				required: true,
				default: '',
				description: 'The text to convert to speech (max 4096 characters)',
				typeOptions: {
					rows: 4,
				},
			},
			{
				displayName: 'Voice',
				name: 'voice',
				type: 'options',
				default: 'af_sky',
				options: [
					{ name: 'Sky (Female)', value: 'af_sky' },
					{ name: 'Bella (Female)', value: 'af_bella' },
					{ name: 'Nova (Female)', value: 'af_nova' },
					{ name: 'Nicole (Female)', value: 'af_nicole' },
					{ name: 'Sarah (Female)', value: 'af_sarah' },
					{ name: 'Adam (Male)', value: 'am_adam' },
					{ name: 'Echo (Male)', value: 'am_echo' },
					{ name: 'Eric (Male)', value: 'am_eric' },
					{ name: 'Michael (Male)', value: 'am_michael' },
					{ name: 'Liam (Male)', value: 'am_liam' },
				],
				description: 'The voice to use for speech synthesis',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Response Format',
						name: 'response_format',
						type: 'options',
						default: 'mp3',
						options: [
							{ name: 'MP3', value: 'mp3' },
							{ name: 'Opus', value: 'opus' },
							{ name: 'AAC', value: 'aac' },
							{ name: 'FLAC', value: 'flac' },
							{ name: 'WAV', value: 'wav' },
							{ name: 'PCM', value: 'pcm' },
						],
						description: 'The format of the output audio',
					},
					{
						displayName: 'Speed',
						name: 'speed',
						type: 'number',
						default: 1,
						typeOptions: {
							minValue: 0.25,
							maxValue: 4,
						},
						description: 'Speed of the speech (0.25-4.0)',
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
				const text = this.getNodeParameter('text', i) as string;
				const voice = this.getNodeParameter('voice', i) as string;
				const options = this.getNodeParameter('options', i) as {
					response_format?: string;
					speed?: number;
				};

				const responseFormat = options.response_format || 'mp3';

				const requestOptions: IRequestOptions = {
					url: `${credentials.baseUrl || 'https://api.venice.ai/api/v1'}/audio/speech`,
					method: 'POST' as IHttpRequestMethods,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
					body: {
						model: 'tts-kokoro',
						input: text,
						voice,
						response_format: responseFormat,
						speed: options.speed || 1,
					},
					json: false,
					encoding: null,
				};

				const response = await this.helpers.request(requestOptions);

				const newItem: INodeExecutionData = {
					json: {
						success: true,
						voice,
						format: responseFormat,
						textLength: text.length,
					},
					binary: {
						data: await this.helpers.prepareBinaryData(
							response,
							`speech.${responseFormat}`,
							`audio/${responseFormat}`,
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
