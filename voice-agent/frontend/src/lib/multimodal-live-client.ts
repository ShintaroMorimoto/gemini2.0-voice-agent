import type {
	Content,
	GenerativeContentBlob,
	Part,
} from "@google/generative-ai";
import { EventEmitter } from "eventemitter3";
import type {
	ClientContentMessage,
	RealtimeInputMessage,
	ServerContent,
	ToolCall,
	ToolCallCancellation
} from "../../multimodal-live-types";

/**
 * the events that this client will emit
 */
interface MultimodalLiveClientEventTypes {
	open: () => void;
	close: (event: CloseEvent) => void;
	audio: (data: ArrayBuffer) => void;
	content: (data: ServerContent) => void;
	interrupted: () => void;
	setupcomplete: () => void;
	turncomplete: () => void;
	toolcall: (toolCall: ToolCall) => void;
	toolcallcancellation: (toolcallCancellation: ToolCallCancellation) => void;
}

export type MultimodalLiveAPIClientConnection = {
	url: string;
};

/**
 * A event-emitting class that manages the connection to the websocket and emits
 * events to the rest of the application.
 * If you dont want to use react you can still use this.
 */
export class MultimodalLiveClient extends EventEmitter<MultimodalLiveClientEventTypes> {
	public ws: WebSocket | null = null;
	public url = "";

	constructor({ url }: MultimodalLiveAPIClientConnection) {
		super();
		url = url || "ws://localhost:8080/ws";
		this.url = url;
		this.send = this.send.bind(this);
	}

	connect(): Promise<boolean> {
		const ws = new WebSocket(this.url);

		ws.addEventListener("message", async (evt: MessageEvent) => {
			this.emit("content", evt.data);
		});
		return new Promise((resolve, reject) => {
			const onError = () => {
				this.disconnect(ws);
				const message = `Could not connect to "${this.url}"`;
				reject(new Error(message));
			};
			ws.addEventListener("error", onError);
			ws.addEventListener("open", () => {
				console.log("connected to socket");
				this.emit("open");

				this.ws = ws;

				ws.removeEventListener("error", onError);
				ws.addEventListener("close", (ev: CloseEvent) => {
					console.log(ev);
					this.disconnect(ws);
					let reason = ev.reason || "";
					if (reason.toLowerCase().includes("error")) {
						const prelude = "ERROR]";
						const preludeIndex = reason.indexOf(prelude);
						if (preludeIndex > 0) {
							reason = reason.slice(
								preludeIndex + prelude.length + 1,
								Number.POSITIVE_INFINITY,
							);
						}
					}
					this.emit("close", ev);
				});
				resolve(true);
			});
		});
	}

	disconnect(ws?: WebSocket) {
		// could be that this is an old websocket and theres already a new instance
		// only close it if its still the correct reference
		if ((!ws || this.ws === ws) && this.ws) {
			this.ws.close();
			this.ws = null;
			return true;
		}
		return false;
	}

	/**
	 * send realtimeInput, this is base64 chunks of "audio/pcm" and/or "image/jpg"
	 */
	sendRealtimeInput(chunks: GenerativeContentBlob[]) {
		let hasAudio = false;
		let hasVideo = false;
		for (let i = 0; i < chunks.length; i++) {
			const ch = chunks[i];
			if (ch.mimeType.includes("audio")) {
				hasAudio = true;
			}
			if (ch.mimeType.includes("image")) {
				hasVideo = true;
			}
			if (hasAudio && hasVideo) {
				break;
			}
		}

		const data: RealtimeInputMessage = {
			realtimeInput: {
				mediaChunks: chunks,
			},
		};
		this._sendDirect(data);
	}

	/**
	 * send normal content parts such as { text }
	 */
	send(parts: Part | Part[], turnComplete = true) {
		parts = Array.isArray(parts) ? parts : [parts];
		const content: Content = {
			role: "user",
			parts,
		};

		const clientContentRequest: ClientContentMessage = {
			clientContent: {
				turns: [content],
				turnComplete,
			},
		};

		this._sendDirect(clientContentRequest);
	}

	/**
	 *  used internally to send all messages
	 *  don't use directly unless trying to send an unsupported message type
	 */
	_sendDirect(request: object) {
		if (!this.ws) {
			throw new Error("WebSocket is not connected");
		}
		const str = JSON.stringify(request);
		this.ws.send(str);
	}
}
