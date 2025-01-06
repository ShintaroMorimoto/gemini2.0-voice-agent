import type {
	Content,
	GenerativeContentBlob,
	Part,
} from '@google/generative-ai';
import EventEmitter from 'eventemitter3';
import { difference } from 'lodash';
import {
	type ClientContentMessage,
	type LiveConfig,
	type LiveIncomingMessage,
	type ModelTurn,
	type RealtimeInputMessage,
	type ServerContent,
	type SetupMessage,
	type StreamingLog,
	type ToolCall,
	type ToolCallCancellation,
	type ToolResponseMessage,
	isInterrupted,
	isModelTurn,
	isServerContenteMessage,
	isSetupCompleteMessage,
	isToolCallCancellationMessage,
	isToolCallMessage,
	isTurnComplete,
} from '../..//multimodal-live-types';
import { base64ToArrayBuffer, blobToJSON } from './utils';

/**
 * the events that this client will emit
 */
interface MultimodalLiveClientEventTypes {
	open: () => void;
	log: (log: StreamingLog) => void;
	close: (event: CloseEvent) => void;
	audio: (data: ArrayBuffer) => void;
	content: (data: ServerContent) => void;
	interrupted: () => void;
	setupcomplete: () => void;
	turncomplete: () => void;
	toolcall: (toolcall: ToolCall) => void;
	toolcallcancellation: (toolcallcancellation: ToolCallCancellation) => void;
}

export type MultimodalLiveAPIClientConnection = {
	url?: string;
};

/**
 * A event-emitting class that manages the connection to the websocket and emits
 * events to the rest of the application.
 * If you dont want to use react you can still use this.
 */
export class MultimodalLiveClient extends EventEmitter<MultimodalLiveClientEventTypes> {
	public ws: WebSocket | null = null;
	protected config: LiveConfig | null = null;
	public url = '';
	public getConfig() {
		return { ...this.config };
	}
	private token: Promise<string | null | undefined> | null = null;

	// TODO: 多分、この辺にVertex AI関連の処理を入れる必要あり。
	// Vertex AIはプロジェクトIDとロケーションが必要なので、
	// それも含めてnew WebSocketをする必要がありそう。
	// いや、違うな。ここはあくまでURLを組み立てているだけ。
	// なので、ここで認証をするのかな、、。
	constructor({ url }: MultimodalLiveAPIClientConnection) {
		super();

		this.token = this._getAccessToken();

		url =
			url ||
			'wss://us-central1-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1alpha.LlmBidiService/BidiGenerateContent';
		this.url = url;
		this.send = this.send.bind(this);
	}

	log(type: string, message: StreamingLog['message']) {
		const log: StreamingLog = {
			date: new Date(),
			type,
			message,
		};
		this.emit('log', log);
	}

	connect(config: LiveConfig): Promise<boolean> {
		this.config = config;

		const ws = new WebSocket(this.url);

		ws.addEventListener('message', async (evt: MessageEvent) => {
			if (evt.data instanceof Blob) {
				this.receive(evt.data);
			} else {
				console.log('non blob message', evt);
			}
		});
		return new Promise((resolve, reject) => {
			const onError = (ev: Event) => {
				this.disconnect(ws);
				const message = `Could not connect to ${this.url}`;
				this.log(`server.${ev.type}`, message);
				reject(new Error(message));
			};
			ws.addEventListener('error', onError);
			ws.addEventListener('open', (ev: Event) => {
				if (!this.config) {
					reject('Invalid config sent to `connect(config)`');
					return;
				}
				this.log(`client.${ev.type}`, 'Connected to socket)');
				ws.send(`Authorization: Bearer ${this.token}`);
				this.emit('open');

				this.ws = ws;

				const SetupMessage: SetupMessage = {
					setup: this.config,
				};
				this._sendDirect(SetupMessage);
				this.log('client.send', 'setup');

				ws.removeEventListener('error', onError);
				ws.addEventListener('close', (ev: CloseEvent) => {
					console.log(ev);
					this.disconnect(ws);
					let reason = ev.reason || '';
					if (reason.toLowerCase().includes('error')) {
						const prelude = 'ERROR]';
						const preludeIndex = reason.indexOf(prelude);
						if (preludeIndex > 0) {
							reason = reason.slice(
								preludeIndex + prelude.length + 1,
								Number.POSITIVE_INFINITY,
							);
						}
					}
					this.log(
						`server.${ev.type}`,
						`disconnected ${reason ? `with reason ${reason}` : ''}`,
					);
					this.emit('close', ev);
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
			this.log('client.close,', 'Disconnected');
			return true;
		}
		return false;
	}

	protected async receive(blob: Blob) {
		const response: LiveIncomingMessage = (await blobToJSON(
			blob,
		)) as LiveIncomingMessage;

		if (isToolCallMessage(response)) {
			this.log('server.toolCall', response);
			this.emit('toolcall', response.toolCall);
			return;
		}
		if (isToolCallCancellationMessage(response)) {
			this.log('receive.toolCallCancellation', response);
			this.emit('toolcallcancellation', response.toolCallCancellation);
			return;
		}
		if (isSetupCompleteMessage(response)) {
			this.log('server.send', 'setUpComplete');
			this.emit('setupcomplete');
		}

		// this json also might be `contentUpdate { interrupted: true }`
		// or contentUpdate { end_of_turn: true }
		if (isServerContenteMessage(response)) {
			const { serverContent } = response;
			if (isInterrupted(serverContent)) {
				this.log('receive.serverContent', 'interrupted');
				this.emit('interrupted');
				return;
			}
			if (isTurnComplete(serverContent)) {
				this.log('server.send', 'turnComplete');
				this.emit('turncomplete');
				// plausible theres more to the message, continue
			}
			if (isModelTurn(serverContent)) {
				let parts: Part[] = serverContent.modelTurn.parts;

				// when its audio that is returned for modelTurn
				const audioParts = parts.filter((p) =>
					p.inlineData?.mimeType.startsWith('audio/pcm'),
				);
				const base64s = audioParts.map((p) => p.inlineData?.data);

				// strip the audio parts out of the modelTurn
				const otherParts = difference(parts, audioParts);

				for (const b64 of base64s) {
					if (b64) {
						const data = base64ToArrayBuffer(b64);
						this.emit('audio', data);
						this.log('server.audio', `buffer (${data.byteLength})`);
					}
				}

				if (!otherParts.length) {
					return;
				}
				parts = otherParts;

				const content: ModelTurn = { modelTurn: { parts } };
				this.emit('content', content);
				this.log('server.content', response);
			}
		} else {
			console.log('received unmathed message', response);
		}
	}
	/**
	 * send realtimeInput, this is base64 chunks of "audio/pcm" and/or "image/jpg"
	 */
	sendRealtimeInput(chunks: GenerativeContentBlob[]) {
		let hasAudio = false;
		for (let i = 0; i < chunks.length; i++) {
			const ch = chunks[i];
			if (ch.mimeType.includes('audio')) {
				hasAudio = true;
			}
			if (hasAudio) {
				break;
			}
		}
		const message = 'audio';

		const data: RealtimeInputMessage = {
			realtimeInput: {
				mediaChunks: chunks,
			},
		};
		this._sendDirect(data);
		this.log('client.realtimeInput', message);
	}
	/**
	 *  send a response to a function call and provide the id of the functions you are responding to
	 */
	sendToolResponse(toolResponse: ToolResponseMessage['toolResponse']) {
		const message: ToolResponseMessage = {
			toolResponse,
		};
		this._sendDirect(message);
		this.log('client.toolResponse', message);
	}
	/**
	 * send normal content parts such as { text }
	 */
	send(parts: Part | Part[], turnComplete = true) {
		const partsArray = Array.isArray(parts) ? parts : [parts];
		const content: Content = {
			role: 'user',
			parts: partsArray,
		};
		const clientContentRequest: ClientContentMessage = {
			clientContent: {
				turns: [content],
				turnComplete,
			},
		};
		this._sendDirect(clientContentRequest);
		this.log('client.send', clientContentRequest);
	}
	/**
	 *  used internally to send all messages
	 *  don't use directly unless trying to send an unsupported message type
	 */
	_sendDirect(request: object) {
		if (!this.ws) {
			throw new Error('WebSocket is not connected');
		}
		const str = JSON.stringify(request);
		this.ws.send(str);
	}

	async _getAccessToken(): Promise<string> {
		const cloudFunctionsUrl = 'http://localhost:8080/';

		try {
			const response = await fetch(cloudFunctionsUrl);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const token = await response.json();
			return token;
		} catch (error) {
			console.error('Error fetching access token:', error);
			throw error;
		}
	}
}
