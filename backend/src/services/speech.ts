import { SpeechClient, protos } from '@google-cloud/speech';

// 音声検出の設定値
export const SILENCE_THRESHOLD = 700; // これ以上のRMS値があれば音声と判断
export const MIN_SILENCE_FRAMES = 15; // 無音判定に必要な連続フレーム数
export const MIN_VOICE_FRAMES = 10; // ノイズ除去のための最小発話フレーム数

export class SpeechService {
	private speechClient: SpeechClient;

	constructor() {
		this.speechClient = new SpeechClient();
	}

	// 音声活性検出
	public detectVoiceActivity(buffer: Buffer): boolean {
		// 16ビットPCMとして解釈
		const samples = new Int16Array(buffer.buffer);

		// RMS（二乗平均平方根）を計算
		const rms = Math.sqrt(
			samples.reduce((sum, sample) => sum + sample * sample, 0) /
				samples.length,
		);

		return rms > SILENCE_THRESHOLD;
	}

	// Speech-to-Text処理（ユーザー音声用）
	public async processSpeechToText(
		audioBuffer: Buffer,
	): Promise<string | undefined> {
		try {
			const request = {
				audio: {
					content: audioBuffer,
				},
				config: {
					encoding:
						protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding
							.LINEAR16,
					sampleRateHertz: 16000,
					languageCode: 'ja-JP',
				},
				interimResults: false,
			};

			const [response] = await this.speechClient.recognize(request);
			const transcription = response.results
				?.map((result) => result.alternatives?.[0]?.transcript)
				.join('\n');

			return transcription;
		} catch (error) {
			if (error instanceof Error) {
				console.error('Speech-to-Text error:', error.message);
			} else {
				console.error('Speech-to-Text error:', error);
			}
			throw error;
		}
	}

	// Vertex AI用の音声認識処理
	public async processVertexAIAudioToText(
		audioBuffer: Buffer,
	): Promise<string | undefined> {
		try {
			console.log('Processing Vertex AI audio...');

			const request = {
				audio: {
					content: audioBuffer.toString('base64'),
				},
				config: {
					encoding:
						protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding
							.LINEAR16,
					sampleRateHertz: 24000,
					languageCode: 'ja-JP',
					enableAutomaticPunctuation: true,
					model: 'default',
					useEnhanced: true,
				},
			};

			const [response] = await this.speechClient.recognize(request);
			const transcription = response.results
				?.map((result) => result.alternatives?.[0]?.transcript)
				.join('\n');

			return transcription;
		} catch (error) {
			if (error instanceof Error) {
				console.error('Vertex AI Speech-to-Text error:', error.message);
			} else {
				console.error('Vertex AI Speech-to-Text error:', error);
			}
			throw error;
		}
	}
}
