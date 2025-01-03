import { AudioStreamer } from '@/lib/audio-streamer';
import {
	type MultimodalLiveAPIClientConnection,
	MultimodalLiveClient,
} from '@/lib/multimodal-live-client';
import { audioContext } from '@/lib/utils';
import type { LiveConfig } from 'multimodal-live-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
	apiKey,
}: MultimodalLiveAPIClientConnection): UseLiveAPIResults {
	const client = useMemo(
		() => new MultimodalLiveClient({ url, apiKey }),
		[url, apiKey],
	);
	const audioStreamRef = useRef<AudioStreamer | null>(null);

	const [connected, setConnected] = useState(false);
	const [config, setConfig] = useState<LiveConfig>({
		model: 'models/gemini-2.0-flash-exp',
	});

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
		};

		const stopAudioStreamer = () => audioStreamRef.current?.stop();

		const onAudio = (data: ArrayBuffer) => {
			audioStreamRef.current?.addPCM16(new Uint8Array(data));
		};

		client
			.on('close', onClose)
			.on('interrupted', stopAudioStreamer)
			.on('audio', onAudio);

		return () => {
			client
				.off('close', onClose)
				.off('interrupted', stopAudioStreamer)
				.off('audio', onAudio);
		};
	}, [client]);

	const connect = useCallback(async () => {
		console.log('config', config);
		if (!config) {
			throw new Error('No config provided');
		}
		client.disconnect();
		await client.connect(config);
		setConnected(true);
	}, [client, config]);

	const disconnect = useCallback(async () => {
		client.disconnect();
		setConnected(false);
	}, [client]);

	return { client, config, setConfig, connected, connect, disconnect };
}
