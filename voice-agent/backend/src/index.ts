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

							// this json also might be `contentUpdate { interrupted: true }`
							// or contentUpdate { end_of_turn: true }
						} else {
							const chunks = (await JSON.parse(data.toString())).realtimeInput
								.mediaChunks;

							const realtimeInput: RealtimeInputMessage = {
								realtimeInput: {
									mediaChunks: chunks,
								},
							};

							clientWs.send(JSON.stringify(realtimeInput));

							// TODO: チャンクをまとめて1リクエストで送る
							let combinedChunk = "";

							for (const chunk of chunks) {
								combinedChunk += chunk;
							}
							console.log("combinedChunk", combinedChunk);

							// Convert base64 to buffer
							const audioBuffer = Buffer.from(combinedChunk, "base64");
							try {
								const request = {
									audio: {
										content: audioBuffer,
									},
									config: {
										encoding:
											protos.google.cloud.speech.v1.RecognitionConfig
												.AudioEncoding.LINEAR16,
										sampleRateHertz: 16000,
										languageCode: "ja-JP",
									},
									interimResults: false,
								};

								// const speechClient = new SpeechClient();

								const response = await speechClient.recognize(request);
								const [result] = response;
								console.log("result.results", result.results);
								const transcription = result.results
									?.map((result: any) => result.alternatives?.[0]?.transcript)
									.join("\n");

								if (transcription) {
									console.log("transcription", transcription);
									// Send transcription result back to client
									/*
											serverWs.send(
												JSON.stringify({
													type: "transcription",
													text: transcription,
												}),
											);
											*/
								}
							} catch (error) {
								console.error("Speech-to-Text error:", error);
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
	// this json also might be `contentUpdate { interrupted: true }`
	// or contentUpdate { end_of_turn: true }
	if (isServerContentMessage(response)) {
		const { serverContent } = response;
		if (isInterrupted(serverContent)) {
			console.log("receive.serverContent", "interrupted");
			return;
		}
		if (isTurnComplete(serverContent)) {
			console.log("receive.serverContent", "turnComplete");
			//plausible theres more to the message, continue
		}
		if (isModelTurn(serverContent)) {
			const parts: Part[] = serverContent.modelTurn.parts;
			// when its audio that is returned for modelTurn
			const audioParts = parts.filter((p) =>
				p.inlineData?.mimeType.startsWith("audio/pcm"),
			);

			const content: ModelTurn = { modelTurn: { parts: audioParts } };
			console.log("server.send", "modelTurn");
			serverWs.send(JSON.stringify(content));
		}
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
	console.log("Current working directory:", process.cwd());

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
