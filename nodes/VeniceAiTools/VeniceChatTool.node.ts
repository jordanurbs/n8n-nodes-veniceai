import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class VeniceChatTool implements INodeType {
	description: INodeTypeDescription & { usableAsTool: boolean } = {
		displayName: 'Venice Chat Tool',
		name: 'veniceChatTool',
		icon: 'file:../VeniceAi/veniceai.svg',
		group: ['transform'],
		version: 1,
		description: 'Send chat messages to Venice AI LLMs for sub-conversations',
		defaults: {
			name: 'Venice Chat',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.venice.ai/api-reference/endpoint/chat/completions',
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
				displayName: 'Message',
				name: 'message',
				type: 'string',
				required: true,
				default: '',
				description: 'The message to send to the AI',
				typeOptions: {
					rows: 4,
				},
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				default: 'llama-3.3-70b',
				options: [
					{ name: 'Llama 3.3 70B', value: 'llama-3.3-70b' },
					{ name: 'Llama 3.1 405B', value: 'llama-3.1-405b' },
					{ name: 'DeepSeek R1 Llama 70B', value: 'deepseek-r1-llama-70b' },
					{ name: 'DeepSeek R1', value: 'deepseek-r1' },
					{ name: 'Qwen 2.5 72B', value: 'qwen-2.5-72b' },
					{ name: 'Dolphin 2.9.2 Mixtral', value: 'dolphin-2.9.2-mixtral-8x22b' },
				],
				description: 'The model to use for chat completion',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'System Prompt',
						name: 'system_prompt',
						type: 'string',
						default: '',
						description: 'System message to set the behavior of the assistant',
						typeOptions: {
							rows: 4,
						},
					},
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						default: 0.7,
						typeOptions: {
							minValue: 0,
							maxValue: 2,
						},
						description: 'Sampling temperature (0-2)',
					},
					{
						displayName: 'Max Tokens',
						name: 'max_tokens',
						type: 'number',
						default: 1000,
						description: 'Maximum number of tokens to generate',
					},
					{
						displayName: 'Character ID',
						name: 'character_id',
						type: 'string',
						default: '',
						description: 'Optional Venice character persona ID to use',
					},
					{
						displayName: 'Enable Web Search',
						name: 'enable_web_search',
						type: 'options',
						default: 'auto',
						options: [
							{ name: 'Auto', value: 'auto' },
							{ name: 'Always', value: 'on' },
							{ name: 'Never', value: 'off' },
						],
						description: 'Whether to enable web search for answers',
					},
					{
						displayName: 'Include Venice System Prompt',
						name: 'include_venice_system_prompt',
						type: 'boolean',
						default: false,
						description: 'Whether to include the Venice default system prompt',
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
				const message = this.getNodeParameter('message', i) as string;
				const model = this.getNodeParameter('model', i) as string;
				const options = this.getNodeParameter('options', i) as {
					system_prompt?: string;
					temperature?: number;
					max_tokens?: number;
					character_id?: string;
					enable_web_search?: string;
					include_venice_system_prompt?: boolean;
				};

				const messages: Array<{ role: string; content: string }> = [];

				// Add system message if provided
				if (options.system_prompt) {
					messages.push({
						role: 'system',
						content: options.system_prompt,
					});
				}

				// Add user message
				messages.push({
					role: 'user',
					content: message,
				});

				const body: Record<string, unknown> = {
					model,
					messages,
					temperature: options.temperature ?? 0.7,
					max_tokens: options.max_tokens ?? 1000,
					venice_parameters: {
						enable_web_search: options.enable_web_search ?? 'auto',
						include_venice_system_prompt: options.include_venice_system_prompt ?? false,
					},
				};

				// Add character ID if provided
				if (options.character_id) {
					(body.venice_parameters as Record<string, unknown>).character_id = options.character_id;
				}

				const requestOptions = {
					url: `${credentials.baseUrl || 'https://api.venice.ai/api/v1'}/chat/completions`,
					method: 'POST' as IHttpRequestMethods,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
					body,
					json: true,
				};

				const response = await this.helpers.request(requestOptions);

				// Extract the response content
				const responseContent = response?.choices?.[0]?.message?.content || '';

				returnData.push({
					json: {
						success: true,
						model,
						input: message,
						output: responseContent,
						usage: response.usage,
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
