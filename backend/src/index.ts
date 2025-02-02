import { SpeechClient } from '@google-cloud/speech';
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
import type { AudioState } from './types/audio.d.ts';

import {
	isInterrupted,
	isModelTurn,
	isServerContentMessage,
	isToolCallCancellationMessage,
	isToolCallMessage,
	isTurnComplete,
} from './types/type-guards.js';

import type {
	GeminiResponse,
	LiveIncomingMessage,
	ModelTurn,
	RealtimeInputMessage,
	SetupMessage,
	ToolResponseMessage,
} from './types/multimodal-live-api.d.ts';

// 音声検出の設定値
const SILENCE_THRESHOLD = 700; // これ以上のRMS値があれば音声と判断
const MIN_SILENCE_FRAMES = 15; // 無音判定に必要な連続フレーム数
const MIN_VOICE_FRAMES = 10; // ノイズ除去のための最小発話フレーム数

// ユーザー音声用の状態管理
export const userAudioState: AudioState = {
	isRecording: false,
	buffer: [],
	silenceCount: 0,
	isProcessing: false,
};

// Vertex AI音声用の状態管理
export const vertexAudioState: AudioState = {
	isRecording: false,
	buffer: [],
	silenceCount: 0,
	isProcessing: false,
};

// 音声処理状態のリセット
const resetAudioState = () => {
	userAudioState.isRecording = false;
	userAudioState.buffer = [];
	userAudioState.silenceCount = 0;
	userAudioState.isProcessing = false;
};

// 最新のtranscriptionTextを保持する変数
let currentTranscriptionText = '';

// メッセージを追加する関数
const appendTranscriptionText = (
	role: 'user_ui' | 'assistant_ui',
	content: string,
) => {
	const prefix = role === 'assistant_ui' ? 'AI' : 'あなた';
	currentTranscriptionText =
		`${currentTranscriptionText}\n${prefix}：${content}`.trim();
};

// Speech-to-Text処理（ユーザー音声用）
const processSpeechToText = async (audioBuffer: Buffer) => {
	if (userAudioState.isProcessing) {
		console.log('Speech recognition already in progress, skipping...');
		return;
	}

	try {
		userAudioState.isProcessing = true;
		const transcription = await speechService.processSpeechToText(audioBuffer);

		if (transcription) {
			console.log('User transcription:', transcription);
			appendTranscriptionText('user_ui', transcription);
			serverWs.send(
				JSON.stringify({
					type: 'transcription',
					role: 'user_ui',
					content: transcription,
					timestamp: new Date().toISOString(),
				}),
			);
		}
	} catch (error) {
		console.error('Speech-to-Text error:', error);
	} finally {
		resetAudioState();
		console.log('User audio state reset after processing');
	}
};

// Vertex AI用の音声認識処理
const processVertexAIAudioToText = async (audioBuffer: Buffer) => {
	try {
		console.log('Processing Vertex AI audio...');
		const transcription =
			await speechService.processVertexAIAudioToText(audioBuffer);

		if (transcription) {
			console.log('VAI transcription:', transcription);
			// 重複チェック
			const lastMessage = currentTranscriptionText.split('\n').pop() || '';
			if (!lastMessage.includes(transcription)) {
				appendTranscriptionText('assistant_ui', transcription);
				serverWs.send(
					JSON.stringify({
						type: 'transcription',
						role: 'assistant_ui',
						content: transcription,
						timestamp: new Date().toISOString(),
					}),
				);
			} else {
				console.log('Skipping duplicate message:', transcription);
			}
		} else {
			console.log('No transcription result from Vertex AI audio');
		}
	} catch (error) {
		console.error('Vertex AI Speech-to-Text error:', error);
	}
};

// 音声活性検出
const detectVoiceActivity = (buffer: Buffer): boolean => {
	// 16ビットPCMとして解釈
	const samples = new Int16Array(buffer.buffer);

	// RMS（二乗平均平方根）を計算
	const rms = Math.sqrt(
		samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length,
	);

	// RMS値をログ出力
	// console.log("Current RMS value:", rms);

	return rms > SILENCE_THRESHOLD;
};

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

let serverWs: WebSocket;
const speechClient = new SpeechClient();
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
									// transcriptionTextを更新
									currentTranscriptionText = parsedData.text;
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
											const isVoiceActive = detectVoiceActivity(buffer);

											if (isVoiceActive) {
												userAudioState.silenceCount = 0;
												userAudioState.buffer.push(buffer);
												userAudioState.isRecording = true;
												// console.log('User voice activity detected');
											} else if (userAudioState.isRecording) {
												userAudioState.silenceCount++;
												userAudioState.buffer.push(buffer);

												if (userAudioState.silenceCount >= MIN_SILENCE_FRAMES) {
													if (
														userAudioState.buffer.length > MIN_VOICE_FRAMES &&
														!userAudioState.isProcessing
													) {
														console.log('Processing accumulated user audio...');
														const combinedBuffer = Buffer.concat(
															userAudioState.buffer,
														);
														await processSpeechToText(combinedBuffer);
													} else {
														resetAudioState();
														console.log(
															'User audio too short or processing in progress, reset state',
														);
													}
													break;
												}
											}
										} catch (error) {
											console.error(
												'Error processing user audio chunk:',
												error,
											);
											resetAudioState();
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

const summarize = async (conversation_history: string) => {
	const project = process.env.PROJECT;
	const location = process.env.LOCATION;
	const apiHost = `${location}-aiplatform.googleapis.com`;
	const modelId = 'gemini-2.0-flash-exp';
	const apiEndpoint = `${apiHost}/v1/projects/${project}/locations/${location}/publishers/google/models/${modelId}:generateContent`;

	const query = `\
		会話内容を要約してください。
		出力は以下のようなマークダウン形式で、箇条書きにしてください。

		形式の例
		### 採用したいポジションの名前
		- 採用したいポジションの名前をここに記載
		### 募集背景(なぜ採用したいのか)
		- 募集背景をここに記載
		### 具体的な業務内容
		- 具体的な業務内容をここに記載
		### 採用したい人の特徴(スキルや経験、正確など)
		- 採用したい人の特徴をここに記載
		### ポジションの魅力(成長機会や他社との違いなど)
		- ポジションの魅力をここに記載
		### キャリアパス(成果を出していくと、どのようなキャリアパスがあるか)
		- キャリアパスをここに記載

		以下が要約してほしい会話内容です。
		${conversation_history}`;

	const data = {
		contents: {
			role: 'USER',
			parts: { text: query },
		},
		generation_config: {
			response_modalities: 'TEXT',
		},
	};
	try {
		const result = await fetch(`https://${apiEndpoint}`, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token.token}`,
			},
			method: 'POST',
			body: JSON.stringify(data),
		});

		if (!result.ok) {
			throw new Error(`API request failed with status ${result.status}`);
		}

		const responseData = (await result.json()) as GeminiResponse;
		const summaryText = responseData.candidates[0]?.content.parts[0]?.text;

		if (!summaryText) {
			throw new Error('No summary text found in response');
		}

		console.log('Summary:', summaryText);
		return summaryText;
	} catch (error) {
		console.error('Error fetching summarize:', error);
		throw error;
	}
};

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
/*
const instructions = `\
	クライアントが採用したいポジションについて、ヒアリングを行ってください。\
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
*/

const sampleInstructions = `\
	クライアントが採用したいポジションについて、ヒアリングを行ってください。\
	まず第一声として「本日はお時間ありがとうございます。早速ですが今日採用したいポジションについて教えていただけますか？」と言ってください。
	## 以下が明確になるまで、ヒアリングを続けてください。\
	- 採用したいポジションの名前 \
	\
	## ヒアリングで意識してほしい点 \
	- "なぜその業務をやるのか" "なぜその経験が必要なのか"といった、目的や背景を深堀りする質問をしてください。\
	- クライアントから抽象的な回答があった場合は、それを具体化(定量化)する深堀り質問をしてください。\
	- クライアントが回答に困っていそうな場合は、具体例や仮説を出して、クライアントのアイデアが出やすくなるような問いかけをしてください
	\
	## ツールの使用 \
	- ヒアリングが終わったら、summarizeツールを使用してヒアリング内容を要約してください。
		- ヒアリング内容は、画面左側に表示されます。\
	- 要約したヒアリング内容について、クライアントとの認識にズレがないか確認してください。\
		- ズレがある場合はヒアリングを再開し、終わったらsummarizeツールを必ず再使用してください。\
	`;

const setUpPrompt = `\
	あなたは${persona}です。\
	<instructions>
	${sampleInstructions}
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
				currentTranscriptionText,
			);
			if (!currentTranscriptionText.trim()) {
				console.log('No conversation to summarize');
				return;
			}
			const summary = await summarizeService.summarize(
				currentTranscriptionText,
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
			// interruptedイベント時に音声認識を実行してからバッファをクリア
			if (vertexAudioState.buffer.length > 0) {
				console.log('Processing accumulated Vertex AI audio at interrupt');
				const combinedBuffer = Buffer.concat(vertexAudioState.buffer);
				await processVertexAIAudioToText(combinedBuffer);
			}
			vertexAudioState.buffer = []; // バッファをクリア
			return;
		}

		if (isTurnComplete(serverContent)) {
			console.log('receive.serverContent', 'turnComplete');
			// turnComplete時に音声認識を実行
			if (vertexAudioState.buffer.length > 0) {
				console.log('Processing accumulated Vertex AI audio at turn complete');
				const combinedBuffer = Buffer.concat(vertexAudioState.buffer);
				await processVertexAIAudioToText(combinedBuffer);
				vertexAudioState.buffer = []; // バッファをクリア
			}
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
					// console.log("Received audio chunk size:", audioBuffer.length);
					vertexAudioState.buffer.push(audioBuffer);
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
			onClose: () => {
				console.log('Connection to UI closed');
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
