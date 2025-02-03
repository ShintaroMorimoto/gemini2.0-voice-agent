import type {
	Interrupted,
	ModelTurn,
	ServerContentMessage,
	ToolCallCancellationMessage,
	ToolCallMessage,
	ToolResponseMessage,
	TurnComplete,
} from './multimodal-live-api.d.ts';

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
