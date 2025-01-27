import { useLiveAPIContext } from "@/contexts/LiveAPIContext";
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { memo, useEffect, useRef, useState } from "react";
import type { ToolCall } from "../../../multimodal-live-types";

import vegaEmbed from "vega-embed";

const declaration: FunctionDeclaration = {
	name: "render_altair",
	description: "Displays an altair graph in json format.",
	parameters: {
		type: SchemaType.OBJECT,
		properties: {
			json_graph: {
				type: SchemaType.STRING,
				description:
					"JSON STRING representation of the graph to render. Must be a string, not a json object",
			},
		},
		required: ["json_graph"],
	},
};

function AltairComponent() {
	const [jsonString, setJSONString] = useState<string>("");
	const { client } = useLiveAPIContext();

	useEffect(() => {
		const onToolCall = (toolCall: ToolCall) => {
			console.log("got toolcall", toolCall);
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
			vegaEmbed(embedRef.current, JSON.parse(jsonString));
		}
	}, [jsonString]);
	return <div className="vega-embed" ref={embedRef} />;
}

export const Altair = memo(AltairComponent);
