import {
	createWorkletFromSrc,
	registeredWorklets,
} from "./audio-worklet-registry";

export class AudioStreamer {
	public audioQueue: Float32Array[] = [];
	private isPlaying = false;
	private sampleRate = 24000;
	private bufferSize = 7680;
	private processingBuffer: Float32Array = new Float32Array(0);
	private scheduledTime = 0;
	public gainNode: GainNode;
	public source: AudioBufferSourceNode;
	private isStreamComplete = false;
	private checkInterval: number | null = null;
	private initialBufferTime = 0.1;
	private endOfQueueAudioSource: AudioBufferSourceNode | null = null;

	public onComplete = () => {};

	constructor(public context: AudioContext) {
		this.gainNode = this.context.createGain();
		this.source = this.context.createBufferSource();
		this.gainNode.connect(this.context.destination);
		this.addPCM16 = this.addPCM16.bind(this);
	}

	async addWorklet<T extends (d: any) => void>(
		workletName: string,
		workletSrc: string,
		handler: T,
	): Promise<this> {
		let workletRecord = registeredWorklets.get(this.context);
		if (workletRecord?.[workletName]) {
			// the worklet already exists on this context
			// add the new handler to it
			workletRecord[workletName].handlers.push(handler);
			return Promise.resolve(this);
		}
		if (!workletRecord) {
			workletRecord = {};
			registeredWorklets.set(this.context, workletRecord);
		}

		// create new record to fill in as becomes available
		workletRecord[workletName] = { handlers: [handler] };

		const src = createWorkletFromSrc(workletName, workletSrc);
		await this.context.audioWorklet.addModule(src);
		const worklet = new AudioWorkletNode(this.context, workletName);

		// add the node into the map
		workletRecord[workletName].node = worklet;

		return this;
	}

	addPCM16(chunk: Uint8Array) {
		const float32Array = new Float32Array(chunk.length / 2);
		const dataView = new DataView(chunk.buffer);

		for (let i = 0; i < chunk.length / 2; i++) {
			try {
				const int16 = dataView.getInt16(i * 2, true);
				float32Array[i] = int16 / 32768;
			} catch (e) {
				console.error(e);
				console.log(
					`dataView.length: ${dataView.byteLength},  i * 2: ${i * 2}`,
				);
			}
		}

		const newBuffer = new Float32Array(
			this.processingBuffer.length + float32Array.length,
		);
		newBuffer.set(this.processingBuffer);
		newBuffer.set(float32Array, this.processingBuffer.length);
		this.processingBuffer = newBuffer;

		while (this.processingBuffer.length >= this.bufferSize) {
			const buffer = this.processingBuffer.slice(0, this.bufferSize);
			this.audioQueue.push(buffer);
			this.processingBuffer = this.processingBuffer.slice(this.bufferSize);
		}
		console.log("isPlaying", this.isPlaying);

		if (!this.isPlaying) {
			this.isPlaying = true;
			this.scheduledTime = this.context.currentTime + this.initialBufferTime;
			this.scheduleNextBuffer();
		}
	}
	private createAudioBuffer(audioData: Float32Array): AudioBuffer {
		const audioBuffer = this.context.createBuffer(
			1,
			audioData.length,
			this.sampleRate,
		);
		audioBuffer.getChannelData(0).set(audioData);
		return audioBuffer;
	}

	private scheduleNextBuffer() {
		const SCHEDULE_AHEAD_TIME = 0.2;

		while (
			this.audioQueue.length > 0 &&
			this.scheduledTime < this.context.currentTime + SCHEDULE_AHEAD_TIME
		) {
			const audioData = this.audioQueue.shift();
			if (!audioData) {
				break;
			}
			const audioBuffer = this.createAudioBuffer(audioData);
			const source = this.context.createBufferSource();

			if (this.audioQueue.length === 0) {
				if (this.endOfQueueAudioSource) {
					this.endOfQueueAudioSource.onended = null;
				}
				this.endOfQueueAudioSource = source;
				source.onended = () => {
					if (
						!this.audioQueue.length &&
						this.endOfQueueAudioSource === source
					) {
						this.endOfQueueAudioSource = null;
						this.onComplete();
					}
				};
			}

			source.buffer = audioBuffer;
			source.connect(this.gainNode);

			const worklets = registeredWorklets.get(this.context);

			if (worklets) {
				for (const [_, graph] of Object.entries(worklets)) {
					const { node, handlers } = graph;
					if (node) {
						source.connect(node);
						node.port.onmessage = (ev: MessageEvent) => {
							for (const handler of handlers) {
								handler.call(node.port, ev);
							}
						};
						node.connect(this.context.destination);
					}
				}
			}

			// i added this trying to fix clicks
			// this.gainNode.gain.setValueAtTime(0, 0);
			// this.gainNode.gain.linearRampToValueAtTime(1, 1);

			// Ensure we never schedule in the past
			const startTime = Math.max(this.scheduledTime, this.context.currentTime);
			source.start(startTime);
			this.scheduledTime = startTime + audioBuffer.duration;
		}

		if (this.audioQueue.length === 0 && this.processingBuffer.length === 0) {
			if (this.isStreamComplete) {
				this.isPlaying = false;
				if (this.checkInterval) {
					clearInterval(this.checkInterval);
					this.checkInterval = null;
				}
			} else {
				if (!this.checkInterval) {
					this.checkInterval = window.setInterval(() => {
						if (
							this.audioQueue.length > 0 ||
							this.processingBuffer.length >= this.bufferSize
						) {
							this.scheduleNextBuffer();
						}
					}, 100) as unknown as number;
				}
			}
		} else {
			const NextCheckTime =
				(this.scheduledTime - this.context.currentTime) * 1000;
			setTimeout(
				() => this.scheduleNextBuffer(),
				Math.max(0, NextCheckTime - 50),
			);
		}
	}

	stop() {
		this.isPlaying = false;
		this.isStreamComplete = true;
		this.audioQueue = [];
		this.processingBuffer = new Float32Array(0);
		this.scheduledTime = this.context.currentTime;

		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
		}

		this.gainNode.gain.linearRampToValueAtTime(
			0,
			this.context.currentTime + 0.1,
		);

		setTimeout(() => {
			this.gainNode.disconnect();
			this.gainNode = this.context.createGain();
			this.gainNode.connect(this.context.destination);
		}, 200);
	}

	async resume() {
		if (this.context.state === "suspended") {
			await this.context.resume();
		}

		this.isStreamComplete = false;
		this.scheduledTime = this.context.currentTime + this.initialBufferTime;
		this.gainNode.gain.setValueAtTime(1, this.context.currentTime);
	}

	complete() {
		this.isStreamComplete = true;
		if (this.processingBuffer.length > 0) {
			this.audioQueue.push(this.processingBuffer);
			this.processingBuffer = new Float32Array(0);
			if (this.isPlaying) {
				this.scheduleNextBuffer();
			}
		} else {
			this.onComplete();
		}
	}
}
