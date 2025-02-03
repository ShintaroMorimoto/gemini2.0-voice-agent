// 音声処理の状態管理用の型定義
export type AudioState = {
	isRecording: boolean;
	buffer: Buffer[];
	silenceCount: number;
	isProcessing: boolean;
};
