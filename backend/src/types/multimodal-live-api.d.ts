import type {
    Content,
    FunctionCall,
    GenerationConfig,
    GenerativeContentBlob,
    Part,
    Tool,
} from '@google/generative-ai';

export type LiveGenerationConfig = GenerationConfig & {
	responseModalities: 'text' | 'audio' | 'image';
	speechConfig?: {
		voiceConfig?: {
			prebuiltVoiceConfig?: {
				voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede' | string;
			};
		};
	};
};

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

export interface ConnectionControlMessage {
	type: 'connection_control';
	action: 'connect' | 'disconnect';
}

export interface ConnectionStatusMessage {
	type: 'connection_status';
	status: 'connected' | 'disconnected';
}

export type LiveIncomingMessage =
	| ServerContentMessage
	| ToolCallMessage
	| ToolCallCancellationMessage
	| ConnectionStatusMessage;

export type LiveFunctionResponse = {
	response: object;
	id: string;
};

export type ToolResponseMessage = {
	toolResponse: {
		functionResponses: LiveFunctionResponse[];
	};
};

export type GeminiResponse = {
	candidates: Array<{
		content: {
			role: string;
			parts: Array<{
				text: string;
			}>;
		};
		finishReason: string;
		avgLogprobs: number;
	}>;
	usageMetadata: {
		promptTokenCount: number;
		candidatesTokenCount: number;
		totalTokenCount: number;
	};
	modelVersion: string;
	createTime: string;
	responseId: string;
};
