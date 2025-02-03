import type WebSocket from 'ws';
import { SpeechService } from '../services/speech.js';
import { AudioStateManager } from './state.js';

export class AudioProcessor {
	private readonly SILENCE_THRESHOLD = 700; // これ以上のRMS値があれば音声と判断
	private readonly MIN_SILENCE_FRAMES = 15; // 無音判定に必要な連続フレーム数
	private readonly MIN_VOICE_FRAMES = 10; // ノイズ除去のための最小発話フレーム数

	private speechService: SpeechService;
	private userAudioState: AudioStateManager;
	private vertexAudioState: AudioStateManager;
	private transcriptionText: string;
	private serverWs: WebSocket;

	constructor(serverWs: WebSocket) {
		this.speechService = new SpeechService();
		this.userAudioState = new AudioStateManager();
		this.vertexAudioState = new AudioStateManager();
		this.transcriptionText = '';
		this.serverWs = serverWs;
	}

	public getCurrentTranscription(): string {
		return this.transcriptionText;
	}

	private appendTranscriptionText(
		role: 'user_ui' | 'assistant_ui',
		content: string,
	): void {
		const prefix = role === 'assistant_ui' ? 'AI' : 'あなた';
		this.transcriptionText =
			`${this.transcriptionText}\n${prefix}：${content}`.trim();
	}

	public detectVoiceActivity(buffer: Buffer): boolean {
		return this.speechService.detectVoiceActivity(buffer);
	}

	public async processUserAudio(buffer: Buffer): Promise<string | undefined> {
		if (this.userAudioState.isProcessing()) {
			console.log('Speech recognition already in progress, skipping...');
			return;
		}

		try {
			this.userAudioState.setProcessing(true);
			const transcription =
				await this.speechService.processSpeechToText(buffer);

			if (transcription) {
				console.log('User transcription:', transcription);
				this.appendTranscriptionText('user_ui', transcription);

				// UIにメッセージを送信
				this.serverWs.send(
					JSON.stringify({
						type: 'transcription',
						role: 'user_ui',
						content: transcription,
						timestamp: new Date().toISOString(),
					}),
				);

				return transcription;
			}
		} catch (error) {
			console.error('Speech-to-Text error:', error);
			throw error;
		} finally {
			this.userAudioState.reset();
			console.log('User audio state reset after processing');
		}
	}

	public async processVertexAIAudio(
		buffer: Buffer,
	): Promise<string | undefined> {
		try {
			console.log('Processing Vertex AI audio...');
			const transcription =
				await this.speechService.processVertexAIAudioToText(buffer);

			if (transcription) {
				console.log('VAI transcription:', transcription);
				// 重複チェック
				const lastMessage = this.transcriptionText.split('\n').pop() || '';
				if (!lastMessage.includes(transcription)) {
					this.appendTranscriptionText('assistant_ui', transcription);

					// UIにメッセージを送信
					this.serverWs.send(
						JSON.stringify({
							type: 'transcription',
							role: 'assistant_ui',
							content: transcription,
							timestamp: new Date().toISOString(),
						}),
					);

					return transcription;
				} else {
					console.log('Skipping duplicate message:', transcription);
				}
			} else {
				console.log('No transcription result from Vertex AI audio');
			}
		} catch (error) {
			console.error('Vertex AI Speech-to-Text error:', error);
			throw error;
		}
	}

	public handleUserAudioChunk(chunk: Buffer): void {
		const isVoiceActive = this.detectVoiceActivity(chunk);

		if (isVoiceActive) {
			this.userAudioState.resetSilenceCount();
			this.userAudioState.addBuffer(chunk);
			this.userAudioState.setRecording(true);
		} else if (this.userAudioState.isRecording()) {
			this.userAudioState.incrementSilenceCount();
			this.userAudioState.addBuffer(chunk);

			if (this.userAudioState.getSilenceCount() >= this.MIN_SILENCE_FRAMES) {
				if (
					this.userAudioState.getBuffer().length > this.MIN_VOICE_FRAMES &&
					!this.userAudioState.isProcessing()
				) {
					console.log('Processing accumulated user audio...');
					void this.processUserAudio(this.userAudioState.getCombinedBuffer());
				} else {
					this.userAudioState.reset();
					console.log(
						'User audio too short or processing in progress, reset state',
					);
				}
			}
		}
	}

	public handleVertexAIAudioChunk(chunk: Buffer): void {
		this.vertexAudioState.addBuffer(chunk);
	}

	public async processAccumulatedVertexAIAudio(): Promise<void> {
		if (this.vertexAudioState.getBuffer().length > 0) {
			const combinedBuffer = this.vertexAudioState.getCombinedBuffer();
			await this.processVertexAIAudio(combinedBuffer);
			this.vertexAudioState.clearBuffer();
		}
	}
}
