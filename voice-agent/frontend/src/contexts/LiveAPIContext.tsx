import { useLiveAPI } from "@/hooks/use-live-api";
import type { MultimodalLiveClient } from "@/lib/multimodal-live-client";
import { type ReactNode, createContext, useContext, useState } from "react";

export type LiveAPIContextType = {
	client: MultimodalLiveClient | null;
	connected: boolean;
	transcriptionText: string;
	setTranscriptionText: (text: string) => void;
	connect: () => Promise<void>;
	disconnect: () => Promise<void>;
};

export const LiveAPIContext = createContext<LiveAPIContextType>({
	client: null,
	connected: false,
	transcriptionText: "",
	setTranscriptionText: () => {},
	connect: async () => {},
	disconnect: async () => {},
});

export type LiveAPIProviderProps = {
	children: ReactNode;
	url: string;
};

export const LiveAPIProvider: React.FC<LiveAPIProviderProps> = ({
	children,
	url,
}) => {
	const [connected, setConnected] = useState(false);
	const [transcriptionText, setTranscriptionText] = useState("");
	const {
		client,
		connect: connectClient,
		disconnect: disconnectClient,
	} = useLiveAPI({
		url,
		setTranscriptionText,
	});

	const connect = async () => {
		await connectClient();
		setConnected(true);
	};

	const disconnect = async () => {
		await disconnectClient();
		setConnected(false);
	};

	return (
		<LiveAPIContext.Provider
			value={{
				client,
				connected,
				transcriptionText,
				setTranscriptionText,
				connect,
				disconnect,
			}}
		>
			{children}
		</LiveAPIContext.Provider>
	);
};

export const useLiveAPIContext = () => {
	const context = useContext(LiveAPIContext);
	if (!context) {
		throw new Error("useLiveAPIContext must be used within a LiveAPIProvider");
	}
	return context;
};
