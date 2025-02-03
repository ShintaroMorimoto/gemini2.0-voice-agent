import type { AudioState } from '../types/audio.d.ts';

export class AudioStateManager {
	private state: AudioState;

	constructor() {
		this.state = {
			isRecording: false,
			buffer: [],
			silenceCount: 0,
			isProcessing: false,
		};
	}

	public getState(): AudioState {
		return { ...this.state };
	}

	public addBuffer(buffer: Buffer): void {
		this.state.buffer.push(buffer);
	}

	public getBuffer(): Buffer[] {
		return [...this.state.buffer];
	}

	public clearBuffer(): void {
		this.state.buffer = [];
	}

	public getCombinedBuffer(): Buffer {
		return Buffer.concat(this.state.buffer);
	}

	public incrementSilenceCount(): void {
		this.state.silenceCount++;
	}

	public resetSilenceCount(): void {
		this.state.silenceCount = 0;
	}

	public getSilenceCount(): number {
		return this.state.silenceCount;
	}

	public setRecording(isRecording: boolean): void {
		this.state.isRecording = isRecording;
	}

	public isRecording(): boolean {
		return this.state.isRecording;
	}

	public setProcessing(isProcessing: boolean): void {
		this.state.isProcessing = isProcessing;
	}

	public isProcessing(): boolean {
		return this.state.isProcessing;
	}

	public reset(): void {
		this.state = {
			isRecording: false,
			buffer: [],
			silenceCount: 0,
			isProcessing: false,
		};
	}
}
