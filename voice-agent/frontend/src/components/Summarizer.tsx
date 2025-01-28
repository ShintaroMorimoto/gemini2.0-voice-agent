import { useLiveAPIContext } from "@/contexts/LiveAPIContext";
import { memo, useEffect, useRef, useState } from "react";
import type { ToolCall } from "../../multimodal-live-types";

function SummarizerComponent() {
	const [jsonString, setJSONString] = useState<string>("");
	const { client } = useLiveAPIContext();

	useEffect(() => {
		const onToolCall = (toolCall: ToolCall) => {
			console.log("got toolcall", toolCall);
			const fc = toolCall.functionCalls.find(
				(fc) => fc.name === declaration.name,
			);
			if (fc) {
				const str = (fc.args as any).conversation_history;
				setJSONString(str);
			}
			// send data for the response of your tool call
			// in this case Im just saying it was successful
			if (toolCall.functionCalls.length) {
				setTimeout(
					() =>
						client?.sendToolResponse({
							functionResponses: toolCall.functionCalls.map((fc) => ({
								response: { output: { success: true } },
								id: fc.id,
							})),
						}),
					200,
				);
			}
		};
		if (client) {
			client.on("toolcall", onToolCall);
		}
		return () => {
			if (client) {
				client.off("toolcall", onToolCall);
			}
		};
	}, [client]);

	const embedRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (embedRef.current && jsonString) {
			summarize(jsonString);
		}
	}, [jsonString]);
	return <div className="vega-embed" ref={embedRef} />;
}

export const Summarizer = memo(SummarizerComponent);
