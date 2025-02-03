import type { Part } from '@google/generative-ai';
import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import * as dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';
import { Hono } from 'hono';
import type { UpgradeWebSocket, WSContext } from 'hono/ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'node:http';
import type { Http2SecureServer, Http2Server } from 'node:http2';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket, { WebSocketServer } from 'ws';

import { SpeechService } from './services/speech.js';
import { SummarizeService } from './services/summarize.js';

import {
	isInterrupted,
	isModelTurn,
	isServerContentMessage,
	isToolCallCancellationMessage,
	isToolCallMessage,
	isTurnComplete,
} from './types/type-guards.js';

import type {
	LiveIncomingMessage,
	ModelTurn,
	RealtimeInputMessage,
	SetupMessage,
	ToolResponseMessage,
} from './types/multimodal-live-api.d.ts';

import { AudioProcessor } from './audio/processor.js';

let serverWs: WebSocket;
let audioProcessor: AudioProcessor;

interface CloseEventInit extends EventInit {
	code?: number;
	reason?: string;
	wasClean?: boolean;
}

/**
 * @link https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
 */
export const CloseEvent =
	globalThis.CloseEvent ??
	class extends Event {
		#eventInitDict;

		constructor(type: string, eventInitDict: CloseEventInit = {}) {
			super(type, eventInitDict);
			this.#eventInitDict = eventInitDict;
		}

		get wasClean(): boolean {
			return this.#eventInitDict.wasClean ?? false;
		}

		get code(): number {
			return this.#eventInitDict.code ?? 0;
		}

		get reason(): string {
			return this.#eventInitDict.reason ?? '';
		}
	};

export interface NodeWebSocket {
	upgradeWebSocket: UpgradeWebSocket;
	injectWebSocket(server: Server | Http2Server | Http2SecureServer): void;
}
export interface NodeWebSocketInit {
	app: Hono;
	baseUrl?: string | URL;
}

/**
 * Create WebSockets for Node.js
 * @param init Options
 * @returns NodeWebSocket
 */
export const createNodeWebSocket = (init: NodeWebSocketInit): NodeWebSocket => {
	const wss = new WebSocketServer({ noServer: true });
	const waiter = new Map<IncomingMessage, (ws: WebSocket) => void>();

	wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
		const waiterFn = waiter.get(request);
		if (waiterFn) {
			waiterFn(ws);
			waiter.delete(request);
		}
	});

	const nodeUpgradeWebSocket = (request: IncomingMessage) => {
		return new Promise<WebSocket>((resolve) => {
			waiter.set(request, resolve);
		});
	};

	return {
		injectWebSocket(server) {
			try {
				server.on('upgrade', async (request, socket, head) => {
					const url = new URL(
						request.url ?? '/',
						init.baseUrl ?? 'http://localhost',
					);

					const headers = new Headers();
					for (const key in request.headers) {
						const value = request.headers[key];
						if (!value) {
							continue;
						}
						headers.append(key, Array.isArray(value) ? value[0] : value);
					}

					await init.app.request(
						url,
						{ headers: headers },
						{ incoming: request, outgoing: undefined },
					);
					wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
						wss.emit('connection', ws, request);
					});
				});
			} catch (error) {
				console.error(error);
			}
		},
		upgradeWebSocket: (createEvents) =>
			async function upgradeWebSocket(c, next) {
				if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
					// Not websocket
					await next();
					return;
				}
				(async () => {
					const events = await createEvents(c);
					serverWs = await nodeUpgradeWebSocket(c.env.incoming);
					// serverWsが初期化された後にAudioProcessorを初期化
					audioProcessor = new AudioProcessor(serverWs);

					const ctx: WSContext = {
						binaryType: 'arraybuffer',
						close(code, reason) {
							serverWs.close(code, reason);
						},
						protocol: serverWs.protocol,
						raw: serverWs,
						get readyState() {
							return serverWs.readyState;
						},
						send(source, opts) {
							serverWs.send(source, {
								compress: opts?.compress,
							});
						},
						url: new URL(c.req.url),
					};

					events.onOpen?.(new Event('open'), ctx);

					serverWs.on('message', async (data) => {
						if (data instanceof Blob) {
							console.log('received blob on message', data);
						} else {
							try {
								const parsedData = await JSON.parse(data.toString());

								if (parsedData.type === 'transcription_update') {
									console.log(
										'Received transcription update:',
										parsedData.text,
									);
								}

								// 音声データの場合
								if (parsedData.realtimeInput?.mediaChunks) {
									const chunks = parsedData.realtimeInput.mediaChunks;

									// Vertex AIに音声データを転送
									const realtimeInput: RealtimeInputMessage = {
										realtimeInput: {
											mediaChunks: chunks,
										},
									};
									clientWs.send(JSON.stringify(realtimeInput));

									// ユーザーの音声認識処理
									for (const chunk of chunks) {
										try {
											if (
												!chunk ||
												typeof chunk !== 'object' ||
												!('data' in chunk) ||
												!('mimeType' in chunk)
											) {
												console.log('Invalid chunk format:', chunk);
												continue;
											}

											if (!chunk.mimeType.includes('audio/pcm')) {
												console.log(
													'Unsupported audio format:',
													chunk.mimeType,
												);
												continue;
											}

											const buffer = Buffer.from(chunk.data, 'base64');
											audioProcessor.handleUserAudioChunk(buffer);
										} catch (error) {
											console.error(
												'Error processing user audio chunk:',
												error,
											);
										}
									}
								}
							} catch (error) {
								console.error('Error parsing WebSocket message:', error);
							}
						}
					});

					serverWs.on('close', () => {
						events.onClose?.(new CloseEvent('close'), ctx);
					});

					serverWs.on('error', (error) => {
						events.onError?.(
							new ErrorEvent('error', {
								error: error,
							}),
							ctx,
						);
					});
				})();

				return new Response();
			},
	};
};
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const project = process.env.PROJECT;
if (!project) {
	throw new Error('PROJECT is not set');
}
const location = process.env.LOCATION;
if (!location) {
	throw new Error('LOCATION is not set');
}
const version = process.env.VERSION;
if (!version) {
	throw new Error('VERSION is not set');
}

// サービスのインスタンス化
const speechService = new SpeechService();
const summarizeService = new SummarizeService(project, location);

const auth = new GoogleAuth({
	scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getApplicationDefault();
const token = await client.credential.getAccessToken();

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({
	app: app,
});

const clientWs = new WebSocket(
	`wss://${location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.${version}.LlmBidiService/BidiGenerateContent`,
	{
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${token.token}`,
		},
	},
);

const summarizeFunctionDeclaration: FunctionDeclaration = {
	name: 'summarize',
	description: 'Summarize the conversation.',
	parameters: {
		type: SchemaType.OBJECT,
		properties: {
			conversation_history: {
				type: SchemaType.STRING,
				description:
					'Conversation history of AI and user. Must be a string, not a json object',
			},
		},
		required: ['conversation_history'],
	},
};

const persona = '中途採用のプロフェッショナル';

const instructions = `\
	クライアントが採用したいポジションについて、ヒアリングを行ってください。\
	第一声では必ず「この度はお時間ありがとうございます。早速ですが、採用したいポジションについて教えていただけますか。」と言ってください。
	
	## 以下が明確になるまで、ヒアリングを続けてください。\
	- 採用したいポジションの名前 \
	- 募集背景(なぜ採用したいのか) \
	- 具体的な業務内容 \
	- 採用したい人の特徴(スキルや経験、正確など) \
	- ポジションの魅力(成長機会や他社との違いなど) \
	- キャリアパス(成果を出していくと、どのようなキャリアパスがあるか) \
	\
	## ヒアリングで意識してほしい点 \
	- "なぜその業務をやるのか" "なぜその経験が必要なのか"といった、目的や背景を深堀りする質問をしてください。\
	- クライアントから抽象的な回答があった場合は、それを具体化(定量化)する深堀り質問をしてください。\
	- クライアントが回答に困っていそうな場合は、具体例や仮説を出して、クライアントのアイデアが出やすくなるような問いかけをしてください。\
	\
	## ツールの使用 \
	- ヒアリングが終わったら、summarizeツールを使用してヒアリング内容を要約してください。
		- ヒアリング内容は、画面左側に表示されます。\
	- 要約したヒアリング内容について、クライアントとの認識齟齬がないか確認してください。\
		- 認識齟齬がある場合はヒアリングを再開して、summarizeツールを再度実行してください。\
	`;

const setUpPrompt = `\
	あなたは${persona}です。\
	<instructions>
	${instructions}
	</instructions>
	\
`;

clientWs.on('open', () => {
	// SetupMessage
	const data: SetupMessage = {
		setup: {
			model: `projects/${project}/locations/${location}/publishers/google/models/gemini-2.0-flash-exp`,
			systemInstruction: {
				parts: [
					{
						text: setUpPrompt,
					},
				],
			},
			generationConfig: {
				responseModalities: 'audio',
			},
			tools: [{ functionDeclarations: [summarizeFunctionDeclaration] }],
		},
	};
	const json = JSON.stringify(data);
	clientWs.send(json);
	console.log('clientWs open');
});

clientWs.on('message', async (message) => {
	const response: LiveIncomingMessage = (await JSON.parse(
		message.toString(),
	)) as LiveIncomingMessage;

	if (isToolCallMessage(response)) {
		const summarizeFunctionCall = response.toolCall.functionCalls.find(
			(fc) => fc.name === summarizeFunctionDeclaration.name,
		);
		if (summarizeFunctionCall) {
			console.log(
				'summarize呼び出し直前のcurrentTranscriptionText',
				audioProcessor.getCurrentTranscription(),
			);
			if (!audioProcessor.getCurrentTranscription().trim()) {
				console.log('No conversation to summarize');
				return;
			}
			const summary = await summarizeService.summarize(
				audioProcessor.getCurrentTranscription(),
			);
			serverWs.send(
				JSON.stringify({
					type: 'toolResponse',
					text: summary,
				}),
			);

			// Vertex AIにツールの実行結果を返す
			const message: ToolResponseMessage = {
				toolResponse: {
					functionResponses: [
						{
							response: { output: { success: true } },
							id: summarizeFunctionCall.id,
						},
					],
				},
			};
			console.log('send', message);
			clientWs.send(JSON.stringify(message));
		}
		return;
	}

	if (isToolCallCancellationMessage(response)) {
		// TODO: ここの処理もいつか作る
		// toolcallがキャンセルされたときの処理
		return;
	}

	if (isServerContentMessage(response)) {
		const { serverContent } = response;

		if (isInterrupted(serverContent)) {
			console.log('receive.serverContent', 'interrupted');
			await audioProcessor.processAccumulatedVertexAIAudio();
			return;
		}

		if (isTurnComplete(serverContent)) {
			console.log('receive.serverContent', 'turnComplete');
			await audioProcessor.processAccumulatedVertexAIAudio();
		}

		if (isModelTurn(serverContent)) {
			const parts: Part[] = serverContent.modelTurn.parts;
			const audioParts = parts.filter((p) =>
				p.inlineData?.mimeType.startsWith('audio/pcm'),
			);

			// 音声データをバッファに追加
			for (const part of audioParts) {
				if (part.inlineData?.data) {
					const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
					audioProcessor.handleVertexAIAudioChunk(audioBuffer);
				}
			}

			// フロントエンドに音声データを転送
			const content: ModelTurn = { modelTurn: { parts: audioParts } };
			serverWs.send(JSON.stringify(content));
		}

		// フロントエンドにVertex AIのメッセージを転送
		serverWs.send(JSON.stringify(response));
	}
});

clientWs.on('close', (message) => {
	console.log('clientWs close', message);
	clientWs.close();
});

clientWs.on('error', (error) => {
	console.error('clientWs error', error);
});

app.get(
	'/ws',
	upgradeWebSocket(() => {
		return {
			onMessage: async (messageEvent) => {
				try {
					const message = messageEvent.toString();
					const parsedData = await JSON.parse(message);

					if (parsedData.realtimeInput?.mediaChunks) {
						const chunks = parsedData.realtimeInput.mediaChunks;

						// Vertex AIに音声データを転送
						const realtimeInput: RealtimeInputMessage = {
							realtimeInput: {
								mediaChunks: chunks,
							},
						};
						clientWs.send(JSON.stringify(realtimeInput));

						// ユーザーの音声認識処理
						for (const chunk of chunks) {
							try {
								if (
									!chunk ||
									typeof chunk !== 'object' ||
									!('data' in chunk) ||
									!('mimeType' in chunk)
								) {
									console.log('Invalid chunk format:', chunk);
									continue;
								}

								if (!chunk.mimeType.includes('audio/pcm')) {
									console.log('Unsupported audio format:', chunk.mimeType);
									continue;
								}

								const buffer = Buffer.from(chunk.data, 'base64');
								audioProcessor.handleUserAudioChunk(buffer);
							} catch (error) {
								console.error('Error processing user audio chunk:', error);
							}
						}
					}

					if (parsedData.type === 'transcription_update') {
						console.log('Received transcription update:', parsedData.text);
						// transcriptionTextを更新
						// Note: この部分は必要に応じてAudioProcessorに移動することも検討可能
					}
				} catch (error) {
					console.error('Error parsing WebSocket message:', error);
				}
			},
			onClose: () => {
				console.log('Connection to UI closed');
				// clientWs.close();
			},
		};
	}),
);

if (process.env.NODE_ENV === 'production') {
	app.use('/*', serveStatic({ root: './dist' }));
	app.use('/*', serveStatic({ root: './public' }));
	app.route('/', app);

	app.use(
		'/favicon.ico',
		serveStatic({
			root: './public',
		}),
	);

	const server = serve({
		fetch: app.fetch,
		port: 8080,
		hostname: '0.0.0.0',
	});

	injectWebSocket(server);
	console.log('Production Server is running on port 8080');
} else {
	const server = serve(app);
	injectWebSocket(server);
	console.log('Local Server is running on port 3000');
}
