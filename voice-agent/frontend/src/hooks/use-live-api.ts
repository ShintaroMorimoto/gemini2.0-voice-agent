import { AudioStreamer } from "@/lib/audio-streamer";
import {
	type MultimodalLiveAPIClientConnection,
	MultimodalLiveClient,
} from "@/lib/multimodal-live-client";
import { audioContext, base64ToArrayBuffer } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type LiveConfig,
	type ServerContent,
	isModelTurn,
} from "../../multimodal-live-types";

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
}: MultimodalLiveAPIClientConnection): UseLiveAPIResults {
	const client = useMemo(() => new MultimodalLiveClient({ url }), [url]);
	const audioStreamRef = useRef<AudioStreamer | null>(null);

	const [connected, setConnected] = useState(false);
	const [config, setConfig] = useState<LiveConfig>({
		model: "models/gemini-2.0-flash-exp",
	});

	useEffect(() => {
		if (!audioStreamRef.current) {
			audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
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
		const onContent = (content: ServerContent) => {
			console.log("onContentにきてるのか、、？", content);
			// 多分、 inlineDataが挟まっていることが原因で、isModelTurnがfalseになっている
			// {"modelTurn":{"parts":[{"inlineData":{"mimeType":"audio/pcm","data":"AA
			if (isModelTurn(content)) {
				console.log("isModelTurnだと認識されている？");
				const audioParts = content.modelTurn.parts.filter((part) =>
					part.inlineData?.mimeType.startsWith("audio/pcm"),
				);
				for (const part of audioParts) {
					if (part.inlineData?.data) {
						const audioData = base64ToArrayBuffer(part.inlineData.data);
						audioStreamRef.current?.addPCM16(new Uint8Array(audioData));
					}
				}
			}
		};

		client
			.on("close", onClose)
			.on("interrupted", stopAudioStreamer)
			.on("audio", onAudio)
			.on("content", onContent);

		return () => {
			client
				.off("close", onClose)
				.off("interrupted", stopAudioStreamer)
				.off("audio", onAudio)
				.off("content", onContent);
		};
	}, [client]);

	const connect = useCallback(async () => {
		console.log("config", config);
		if (!config) {
			throw new Error("No config provided");
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
