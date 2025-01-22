import type {
	Content,
	GenerationConfig,
	Part,
	Tool,
} from "@google/generative-ai";
import { serve } from "@hono/node-server";
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
					const serverWs = await nodeUpgradeWebSocket(c.env.incoming);

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

					serverWs.on("message", (data, isBinary) => {
						const datas = Array.isArray(data) ? data : [data];
						for (const data of datas) {
							events.onMessage?.(
								new MessageEvent("message", {
									data: isBinary ? data : data.toString("utf-8"),
								}),
								ctx,
							);
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

const project = "genaipocctc";
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
						text: "レスポンスは簡素にしてください。",
					},
				],
			},
			generationConfig: {
				responseModalities: "text",
			},
		},
	};
	const json = JSON.stringify(data);
	clientWs.send(json);
	console.log("clientWs open");
});

clientWs.on("message", (message) => {
	console.log("message from Gemini", message.toString());
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
			onMessage(event) {
				const data: ClientContentMessage = {
					clientContent: {
						turns: [
							{
								parts: [
									{
										text: "Hello, How are you?",
									},
								],
								role: "user",
							},
						],
						turnComplete: true,
					},
				};
				const json = JSON.stringify(data);
				clientWs.send(json);
			},
			onClose: () => {
				console.log("Connection to UI closed");
			},
		};
	}),
);

const server = serve(app);
injectWebSocket(server);
console.log("Server is running on port 3000");
