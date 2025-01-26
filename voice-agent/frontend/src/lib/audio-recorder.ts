import EventEmitter from "eventemitter3";
import { createWorkletFromSrc } from "./audio-worklet-registry";
import { audioContext } from "./utils";
import AudioRecordingWorklet from "./worklets/audio-processing";

function arrayBufferToBase64(buffer: ArrayBuffer) {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return window.btoa(binary);
}

export class AudioRecorder extends EventEmitter {
	stream: MediaStream | undefined;
	audioContext: AudioContext | undefined;
	source: MediaStreamAudioSourceNode | undefined;
	recording = false;
	recordingWorklet: AudioWorkletNode | undefined;

	private starting: Promise<void> | null = null;

	constructor(public sampleRate = 16000) {
		super();
	}
	async start() {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			throw new Error("Cloud not request user media");
		}

		this.starting = new Promise((resolve, reject) => {
			(async () => {
				try {
					this.stream = await navigator.mediaDevices.getUserMedia({
						audio: true,
					});
					this.audioContext = await audioContext({
						sampleRate: this.sampleRate,
					});
					this.source = this.audioContext.createMediaStreamSource(this.stream);

					const workletName = "audio-recorder-worklet";
					const src = createWorkletFromSrc(workletName, AudioRecordingWorklet);

					await this.audioContext.audioWorklet.addModule(src);
					this.recordingWorklet = new AudioWorkletNode(
						this.audioContext,
						workletName,
					);

					this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
						const arrayBuffer = ev.data.data.int16arrayBuffer;

						if (arrayBuffer) {
							const arrayBufferString = arrayBufferToBase64(arrayBuffer);
							this.emit("data", arrayBufferString);
						}
					};
					this.source.connect(this.recordingWorklet);

					this.recording = true;
					resolve();
					this.starting = null;
				} catch (error) {
					reject(error);
				}
			})();
		});
	}
	stop() {
		// start 関数は非同期処理であるため、それが完了していない場合はその完了を待つ
		const handleStop = () => {
			this.source?.disconnect();
			if (this.stream) {
				for (const track of this.stream.getTracks()) {
					track.stop();
				}
			}
			this.stream = undefined;
			this.recordingWorklet = undefined;
		};
		if (this.starting) {
			this.starting.then(handleStop);
			return;
		}
		handleStop();
	}
}
