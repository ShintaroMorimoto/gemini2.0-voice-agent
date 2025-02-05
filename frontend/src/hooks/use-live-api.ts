import { AudioStreamer } from '@/lib/audio-streamer';
import {
    type MultimodalLiveAPIClientConnection,
    MultimodalLiveClient,
} from '@/lib/multimodal-live-client';
import { audioContext, base64ToArrayBuffer } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    type LiveConfig,
    type ServerContent,
    isModelTurn,
} from '../../multimodal-live-types';

export type UseLiveAPIResults = {
	client: MultimodalLiveClient;
	setConfig: (config: LiveConfig) => void;
	config: LiveConfig;
	connected: boolean;
	connect: () => Promise<void>;
	disconnect: () => Promise<void>;
};

export function useLiveAPI({
	url,
	setTranscriptionText,
	setSummaryText,
}: MultimodalLiveAPIClientConnection & {
	setTranscriptionText: (
		text: string | ((prevState: string) => string),
	) => void;
	setSummaryText: (text: string) => void;
}): UseLiveAPIResults {
	const client = useMemo(() => new MultimodalLiveClient({ url }), [url]);
	const audioStreamRef = useRef<AudioStreamer | null>(null);
	const [connected, setConnected] = useState(false);
	const [config, setConfig] = useState<LiveConfig>({
		model: 'models/gemini-2.0-flash-exp',
	});
	const connectPromiseRef = useRef<{
		resolve: (value: boolean) => void;
		reject: (reason?: any) => void;
	} | null>(null);

	useEffect(() => {
		if (!audioStreamRef.current) {
			audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
				audioStreamRef.current = new AudioStreamer(audioCtx);
			});
		}
	}, []);

	// register audio for streaming server -> speakers
	useEffect(() => {
		const onClose = () => {
			setConnected(false);
			connectPromiseRef.current?.reject(new Error('Connection closed'));
			connectPromiseRef.current = null;
		};

		const stopAudioStreamer = () => audioStreamRef.current?.stop();

		const onAudio = (data: ArrayBuffer) => {
			audioStreamRef.current?.addPCM16(new Uint8Array(data));
		};

		const onContent = (content: ServerContent) => {
			try {
				if (typeof content === 'string') {
					const parsedContent = JSON.parse(content);
					if (parsedContent.type === 'connection_status') {
						const isConnected = parsedContent.status === 'connected';
						setConnected(isConnected);
						if (isConnected) {
							connectPromiseRef.current?.resolve(true);
						} else {
							connectPromiseRef.current?.reject(new Error('Connection failed'));
						}
						connectPromiseRef.current = null;
						return;
					}

					if (isModelTurn(parsedContent)) {
						const audioParts = parsedContent.modelTurn.parts.filter((part) =>
							part.inlineData?.mimeType.startsWith('audio/pcm'),
						);
						for (const part of audioParts) {
							if (part.inlineData?.data) {
								const audioData = base64ToArrayBuffer(part.inlineData.data);
								audioStreamRef.current?.addPCM16(new Uint8Array(audioData));
							}
						}
					} else if (parsedContent.type === 'transcription') {
						setTranscriptionText((prevText) => {
							const prefix =
								parsedContent.role === 'assistant_ui' ? 'AI' : 'あなた';
							return `${prevText}\n${prefix}：${parsedContent.content}`;
						});
					} else if (parsedContent.type === 'toolResponse') {
						setSummaryText(parsedContent.text);
					}
				}
			} catch (error) {
				console.error('Error parsing content:', error);
			}
		};

		client
			.on('close', onClose)
			.on('interrupted', stopAudioStreamer)
			.on('audio', onAudio)
			.on('content', onContent);

		return () => {
			client
				.off('close', onClose)
				.off('interrupted', stopAudioStreamer)
				.off('audio', onAudio)
				.off('content', onContent);
		};
	}, [client, setTranscriptionText, setSummaryText]);

	const connect = useCallback(async () => {
		try {
			client.disconnect();
			await client.connect();

			// Promiseを作成して、connection_statusメッセージを待つ
			const connectionPromise = new Promise<boolean>((resolve, reject) => {
				// タイムアウト処理
				const timeoutId = setTimeout(() => {
					reject(new Error('Connection timeout'));
					connectPromiseRef.current = null;
				}, 10000); // 10秒でタイムアウト

				// resolveとrejectを保存
				connectPromiseRef.current = {
					resolve: (value: boolean) => {
						clearTimeout(timeoutId);
						resolve(value);
					},
					reject: (reason?: any) => {
						clearTimeout(timeoutId);
						reject(reason);
					},
				};
			});

			// バックエンドにconnect要求を送信
			client.ws?.send(
				JSON.stringify({
					type: 'connection_control',
					action: 'connect',
				}),
			);

			// connection_statusメッセージを待つ
			await connectionPromise;
		} catch (error) {
			console.error('Connection error:', error);
			setConnected(false);
			throw error;
		}
	}, [client]);

	const disconnect = useCallback(async () => {
		try {
			client.ws?.send(
				JSON.stringify({
					type: 'connection_control',
					action: 'disconnect',
				}),
			);
			client.disconnect();
			setConnected(false);
		} catch (error) {
			console.error('Disconnection error:', error);
		}
	}, [client]);

	return { client, config, setConfig, connected, connect, disconnect };
}
