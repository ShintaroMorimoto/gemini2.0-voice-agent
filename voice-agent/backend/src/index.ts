import { SpeechClient, protos } from "@google-cloud/speech";
import type {
	Content,
	GenerationConfig,
	GenerativeContentBlob,
	Part,
	Tool,
} from "@google/generative-ai";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { GoogleAuth } from "google-auth-library";
import { Hono } from "hono";
import type { UpgradeWebSocket, WSContext } from "hono/ws";
import type { IncomingMessage } from "http";
import type { Server } from "node:http";
import type { Http2SecureServer, Http2Server } from "node:http2";
import WebSocket, { WebSocketServer } from "ws";

export type LiveGenerationConfig = GenerationConfig & {
	responseModalities: "text" | "audio" | "image";
	speechConfig?: {
		voiceConfig?: {
			prebuiltVoiceConfig?: {
				voiceName: "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede" | string;
			};
		};
	};
};

export type LiveConfig = {
	model: string;
	systemInstruction?: { parts: Part[] };
	generationConfig?: Partial<LiveGenerationConfig>;
	tools?: Array<Tool | { googleSearch: {} } | { codeExecution: {} }>;
};

export type SetupMessage = {
	setup: LiveConfig;
};

export type RealtimeInputMessage = {
	realtimeInput: {
		mediaChunks: GenerativeContentBlob[];
	};
};

export type ClientContentMessage = {
	clientContent: {
		turns: Content[];
		turnComplete: boolean;
	};
};
export type ModelTurn = {
	modelTurn: {
		parts: Part[];
	};
};

export type TurnComplete = { turnComplete: boolean };

export type Interrupted = { interrupted: true };

export type ServerContent = ModelTurn | TurnComplete | Interrupted;

export type ServerContentMessage = {
	serverContent: ServerContent;
};

export type LiveIncomingMessage = ServerContentMessage;

// 音声処理の状態管理用の型定義
type AudioState = {
	isRecording: boolean;
	buffer: Buffer[];
	silenceCount: number;
	isProcessing: boolean;
};

// ユーザー音声用の状態管理
const userAudioState: AudioState = {
	isRecording: false,
	buffer: [],
	silenceCount: 0,
	isProcessing: false,
};

// Vertex AI音声用の状態管理
const vertexAudioState: AudioState = {
	isRecording: false,
	buffer: [],
	silenceCount: 0,
	isProcessing: false,
};

// 音声検出の設定値
const SILENCE_THRESHOLD = 700; // これ以上のRMS値があれば音声と判断
const MIN_SILENCE_FRAMES = 10; // 無音判定に必要な連続フレーム数
const MIN_VOICE_FRAMES = 5; // ノイズ除去のための最小発話フレーム数

// 音声処理状態のリセット
const resetAudioState = () => {
	userAudioState.isRecording = false;
	userAudioState.buffer = [];
	userAudioState.silenceCount = 0;
	userAudioState.isProcessing = false;
};

// Speech-to-Text処理（ユーザー音声用）
const processSpeechToText = async (audioBuffer: Buffer) => {
	if (userAudioState.isProcessing) {
		console.log("Speech recognition already in progress, skipping...");
		return;
	}

	try {
		userAudioState.isProcessing = true;
		const request = {
			audio: {
				content: audioBuffer,
			},
			config: {
				encoding:
					protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding
						.LINEAR16,
				sampleRateHertz: 16000,
				languageCode: "ja-JP",
			},
			interimResults: false,
		};

		const [response] = await speechClient.recognize(request);
		const transcription = response.results
			?.map((result) => result.alternatives?.[0]?.transcript)
			.join("\n");

		if (transcription) {
			console.log("User transcription:", transcription);
			serverWs.send(
				JSON.stringify({
					type: "transcription",
					text: transcription,
				}),
			);
		}
	} catch (error) {
		if (error instanceof Error) {
			console.error("Speech-to-Text error:", error.message);
		} else {
			console.error("Speech-to-Text error:", error);
		}
	} finally {
		resetAudioState();
		console.log("User audio state reset after processing");
	}
};

// Vertex AI用の音声認識処理
const processVertexAIAudioToText = async (audioBuffer: Buffer) => {
	try {
		console.log("Processing Vertex AI audio...");
		console.log("Audio buffer size:", audioBuffer.length);

		const request = {
			audio: {
				content: audioBuffer.toString("base64"),
			},
			config: {
				encoding:
					protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding
						.LINEAR16,
				sampleRateHertz: 24000,
				languageCode: "ja-JP",
				enableAutomaticPunctuation: true,
				model: "default",
				useEnhanced: true,
			},
		};

		const [response] = await speechClient.recognize(request);
		const transcription = response.results
			?.map((result) => result.alternatives?.[0]?.transcript)
			.join("\n");

		if (transcription) {
			console.log("VAI transcription:", transcription);
			serverWs.send(
				JSON.stringify({
					type: "transcription",
					text: `\nAI： ${transcription}`,
				}),
			);
		} else {
			console.log("No transcription result from Vertex AI audio");
		}
	} catch (error) {
		if (error instanceof Error) {
			console.error("Vertex AI Speech-to-Text error:", error.message);
		} else {
			console.error("Vertex AI Speech-to-Text error:", error);
		}
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
	console.log("Current RMS value:", rms);

	return rms > SILENCE_THRESHOLD;
};

const prop = (a: any, prop: string, kind = "object") =>
	typeof a === "object" && typeof a[prop] === "object";

export const isServerContentMessage = (a: any): a is ServerContentMessage =>
	prop(a, "serverContent");
export const isModelTurn = (a: any): a is ModelTurn =>
	typeof (a as ModelTurn).modelTurn === "object";

export const isTurnComplete = (a: any): a is TurnComplete =>
	typeof (a as TurnComplete).turnComplete === "boolean";

export const isInterrupted = (a: any): a is Interrupted =>
	(a as Interrupted).interrupted;

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
			return this.#eventInitDict.reason ?? "";
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

	wss.on("connection", (ws, request) => {
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
				server.on("upgrade", async (request, socket, head) => {
					const url = new URL(
						request.url ?? "/",
						init.baseUrl ?? "http://localhost",
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
					wss.handleUpgrade(request, socket, head, (ws) => {
						wss.emit("connection", ws, request);
					});
				});
			} catch (error) {
				console.error(error);
			}
		},
		upgradeWebSocket: (createEvents) =>
			async function upgradeWebSocket(c, next) {
				if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
					// Not websocket
					await next();
					return;
				}
				(async () => {
					const events = await createEvents(c);
					serverWs = await nodeUpgradeWebSocket(c.env.incoming);

					const ctx: WSContext = {
						binaryType: "arraybuffer",
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

					events.onOpen?.(new Event("open"), ctx);

					serverWs.on("message", async (data) => {
						if (data instanceof Blob) {
							console.log("received blob on message", data);
						} else {
							try {
								const parsedData = await JSON.parse(data.toString());

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
												typeof chunk !== "object" ||
												!("data" in chunk) ||
												!("mimeType" in chunk)
											) {
												console.log("Invalid chunk format:", chunk);
												continue;
											}

											if (!chunk.mimeType.includes("audio/pcm")) {
												console.log(
													"Unsupported audio format:",
													chunk.mimeType,
												);
												continue;
											}

											const buffer = Buffer.from(chunk.data, "base64");
											const isVoiceActive = detectVoiceActivity(buffer);

											if (isVoiceActive) {
												userAudioState.silenceCount = 0;
												userAudioState.buffer.push(buffer);
												userAudioState.isRecording = true;
												console.log("User voice activity detected");
											} else if (userAudioState.isRecording) {
												userAudioState.silenceCount++;
												userAudioState.buffer.push(buffer);
												console.log(
													"Silence detected, count:",
													userAudioState.silenceCount,
												);

												if (userAudioState.silenceCount >= MIN_SILENCE_FRAMES) {
													if (
														userAudioState.buffer.length > MIN_VOICE_FRAMES &&
														!userAudioState.isProcessing
													) {
														console.log("Processing accumulated user audio...");
														const combinedBuffer = Buffer.concat(
															userAudioState.buffer,
														);
														await processSpeechToText(combinedBuffer);
													} else {
														resetAudioState();
														console.log(
															"User audio too short or processing in progress, reset state",
														);
													}
													break;
												}
											}
										} catch (error) {
											console.error(
												"Error processing user audio chunk:",
												error,
											);
											resetAudioState();
										}
									}
								}
							} catch (error) {
								console.error("Error parsing WebSocket message:", error);
							}
						}
					});

					serverWs.on("close", () => {
						events.onClose?.(new CloseEvent("close"), ctx);
					});

					serverWs.on("error", (error) => {
						events.onError?.(
							new ErrorEvent("error", {
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

// TODO: 環境変数から読むようにする
const project = "sandbox-morimoto-s1";
const location = "us-central1";
const version = "v1beta1";

const auth = new GoogleAuth({
	scopes: ["https://www.googleapis.com/auth/cloud-platform"],
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
			"content-type": "application/json",
			authorization: `Bearer ${token.token}`,
		},
	},
);

clientWs.on("open", () => {
	// SetupMessage
	const data: SetupMessage = {
		setup: {
			model: `projects/${project}/locations/${location}/publishers/google/models/gemini-2.0-flash-exp`,
			systemInstruction: {
				parts: [
					{
						text: "\
            		あなたはSIerの優秀なエンジニアです。\
					あなたはクライアントに対して、ヒアリングを行います。\
					ヒアリング内容は、クライアントが作りたいと考えているシステムについてです。 \
            		以下が明確になるまで、ヒアリングを続けてください。\
            		- だれが使うシステムなのか \
            		- どんなときに使われるシステムなのか \
            		- どんな機能が必要なのか \
					\
					## ヒアリングルール \
					- あいまいな点があった場合は深堀りして聞いてください。\
					-  \
            		",
					},
				],
			},
			generationConfig: {
				responseModalities: "audio",
			},
		},
	};
	const json = JSON.stringify(data);
	clientWs.send(json);
	console.log("clientWs open");
});

clientWs.on("message", async (message) => {
	const response: LiveIncomingMessage = (await JSON.parse(
		message.toString(),
	)) as LiveIncomingMessage;

	if (isServerContentMessage(response)) {
		const { serverContent } = response;

		if (isInterrupted(serverContent)) {
			console.log("receive.serverContent", "interrupted");
			vertexAudioState.buffer = []; // バッファをクリア
			return;
		}

		if (isTurnComplete(serverContent)) {
			console.log("receive.serverContent", "turnComplete");
			// turnComplete時に音声認識を実行
			if (vertexAudioState.buffer.length > 0) {
				console.log("Processing accumulated Vertex AI audio at turn complete");
				console.log("Buffer size:", vertexAudioState.buffer.length);
				const combinedBuffer = Buffer.concat(vertexAudioState.buffer);
				console.log("Combined buffer size:", combinedBuffer.length);
				await processVertexAIAudioToText(combinedBuffer);
				vertexAudioState.buffer = []; // バッファをクリア
			}
		}

		if (isModelTurn(serverContent)) {
			const parts: Part[] = serverContent.modelTurn.parts;
			const audioParts = parts.filter((p) =>
				p.inlineData?.mimeType.startsWith("audio/pcm"),
			);

			// 音声データをバッファに追加
			for (const part of audioParts) {
				if (part.inlineData?.data) {
					console.log("Vertex AIからの音声データを受信しました");
					const audioBuffer = Buffer.from(part.inlineData.data, "base64");
					console.log("Received audio chunk size:", audioBuffer.length);
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

clientWs.on("close", (message) => {
	console.log("clientWs close", message);
	clientWs.close();
});

clientWs.on("error", (error) => {
	console.error("clientWs error", error);
});

app.get(
	"/ws",
	upgradeWebSocket(() => {
		return {
			onClose: () => {
				console.log("Connection to UI closed");
			},
		};
	}),
);

if (process.env.NODE_ENV === "production") {
	app.use("/*", serveStatic({ root: "./dist" }));
	app.use("/*", serveStatic({ root: "./public" }));
	app.route("/", app);

	app.use(
		"/favicon.ico",
		serveStatic({
			root: "./public",
		}),
	);

	const server = serve({
		fetch: app.fetch,
		port: 8080,
		hostname: "0.0.0.0",
	});

	injectWebSocket(server);
	console.log("Production Server is running on port 8080");
} else {
	const server = serve(app);
	injectWebSocket(server);
	console.log("Local Server is running on port 3000");
}
