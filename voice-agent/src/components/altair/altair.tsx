import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { type FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { memo, useEffect, useRef, useState } from 'react';
import vegaEmbed from 'vega-embed';
import type { ToolCall } from '../../../multimodal-live-types';

const declaration: FunctionDeclaration = {
	name: 'render_altair',
	description: 'Displays an altair graph in json format.',
	parameters: {
		type: SchemaType.OBJECT,
		properties: {
			json_graph: {
				type: SchemaType.STRING,
				description:
					'JSON STRING representation of the graph to render. Must be a string, not a json object',
			},
		},
		required: ['json_graph'],
	},
};

const API_KEY = import.meta.env.VITE_REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== 'string') {
	throw new Error('REACT_APP_GEMINI_API_KEY is not set in .env');
}

const PROJECT = import.meta.env.VITE_VERTEX_AI_PROJECT as string;
if (typeof PROJECT !== 'string') {
	throw new Error('VITE_VERTEX_AI_PROJECT is not set in .env');
}

const LOCATION = import.meta.env.VITE_VERTEX_AI_LOCATION as string;
if (typeof LOCATION !== 'string') {
	throw new Error('VITE_VERTEX_AI_LOCATION is not set in .env');
}

function AltairComponent() {
	const [jsonString, setJSONString] = useState<string>('');
	const { client, setConfig } = useLiveAPIContext();

	useEffect(() => {
		setConfig({
			// model: `projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/gemini-2.0-flash-exp`,
			model: 'models/gemini-2.0-flash-exp',
			generationConfig: {
				responseModalities: 'audio',
				speechConfig: {
					voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
				},
			},
			systemInstruction: {
				parts: [
					{
						text: '\
            あなたはSIerの優秀なエンジニアです。\
			クライアントがこれから作りたいシステムについて、あなたがヒアリングを行います。\
            以下が明確になるまで、ヒアリングを続けてください。\
            - だれが使うシステムなのか \
            - どんなときに使われるシステムなのか \
            - どんな機能が必要なのか \
            ',
					},
				],
			},
			tools: [
				// there is a free-tier quota for search
				{ googleSearch: {} },
				{ functionDeclarations: [declaration] },
			],
		});
	}, [setConfig]);

	useEffect(() => {
		const onToolCall = (toolCall: ToolCall) => {
			console.log('got toolcall', toolCall);
			const fc = toolCall.functionCalls.find(
				(fc) => fc.name === declaration.name,
			);
			if (fc) {
				const str = (fc.args as any).json_graph;
				setJSONString(str);
			}
			// send data for the response of your tool call
			// in this case Im just saying it was successful
			if (toolCall.functionCalls.length) {
				setTimeout(
					() =>
						client.sendToolResponse({
							functionResponses: toolCall.functionCalls.map((fc) => ({
								response: { output: { success: true } },
								id: fc.id,
							})),
						}),
					200,
				);
			}
		};
		client.on('toolcall', onToolCall);
		return () => {
			client.off('toolcall', onToolCall);
		};
	}, [client]);

	const embedRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (embedRef.current && jsonString) {
			vegaEmbed(embedRef.current, JSON.parse(jsonString));
		}
	}, [jsonString]);
	return <div className="vega-embed" ref={embedRef} />;
}

export const Altair = memo(AltairComponent);
