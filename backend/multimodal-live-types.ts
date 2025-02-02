export type LiveConfig = {
	model: string;
	systemInstruction?: { parts: Part[] };
	generationConfig?: Partial<LiveGenerationConfig>;
	tools?: Array<Tool | { googleSearch: {} } | { codeExecution: {} }>;
};

export type SetupMessage = {
	setup: LiveConfig;
};

export type RealtimeInputMessage = {
	realtimeInput: {
		mediaChunks: GenerativeContentBlob[];
	};
};

export type ClientContentMessage = {
	clientContent: {
		turns: Content[];
		turnComplete: boolean;
	};
};
export type ModelTurn = {
	modelTurn: {
		parts: Part[];
	};
};

export type TurnComplete = { turnComplete: boolean };

export type Interrupted = { interrupted: true };

export type ServerContent = ModelTurn | TurnComplete | Interrupted;

export type ServerContentMessage = {
	serverContent: ServerContent;
};

export type LiveFunctionCall = FunctionCall & {
	id: string;
};

export type ToolCall = {
	functionCalls: LiveFunctionCall[];
};

export type ToolCallCancellationMessage = {
	toolCallCancellation: {
		ids: string[];
	};
};

export type ToolCallCancellation =
	ToolCallCancellationMessage['toolCallCancellation'];

export type ToolCallMessage = {
	toolCall: ToolCall;
};
export type LiveIncomingMessage =
	| ServerContentMessage
	| ToolCallCancellationMessage
	| ToolCallMessage;

export type LiveFunctionResponse = {
	response: object;
	id: string;
};

export type ToolResponseMessage = {
	toolResponse: {
		functionResponses: LiveFunctionResponse[];
	};
};
// 音声処理の状態管理用の型定義
type AudioState = {
	isRecording: boolean;
	buffer: Buffer[];
	silenceCount: number;
	isProcessing: boolean;
};

// ユーザー音声用の状態管理
const userAudioState: AudioState = {
	isRecording: false,
	buffer: [],
	silenceCount: 0,
	isProcessing: false,
};

// Vertex AI音声用の状態管理
const vertexAudioState: AudioState = {
	isRecording: false,
	buffer: [],
	silenceCount: 0,
	isProcessing: false,
};

const prop = (a: any, prop: string, kind = 'object') =>
	typeof a === 'object' && typeof a[prop] === 'object';

export const isServerContentMessage = (a: any): a is ServerContentMessage =>
	prop(a, 'serverContent');

export const isToolResponseMessage = (a: unknown): a is ToolResponseMessage =>
	prop(a, 'toolResponse');

export const isToolCallMessage = (a: any): a is ToolCallMessage =>
	prop(a, 'toolCall');

export const isToolCallCancellation = (
	a: unknown,
): a is ToolCallCancellationMessage['toolCallCancellation'] =>
	typeof a === 'object' && Array.isArray((a as any).ids);

export const isToolCallCancellationMessage = (
	a: unknown,
): a is ToolCallCancellationMessage =>
	prop(a, 'toolCallCancellation') &&
	isToolCallCancellation((a as any).toolCallCancellation);

export const isModelTurn = (a: any): a is ModelTurn =>
	typeof (a as ModelTurn).modelTurn === 'object';

export const isTurnComplete = (a: any): a is TurnComplete =>
	typeof (a as TurnComplete).turnComplete === 'boolean';

export const isInterrupted = (a: any): a is Interrupted =>
	(a as Interrupted).interrupted;

interface CloseEventInit extends EventInit {
	code?: number;
	reason?: string;
	wasClean?: boolean;
}