import { type UseLiveAPIResults, useLiveAPI } from "@/hooks/use-live-api";
import { type FC, type ReactNode, createContext, useContext } from "react";

const LiveAPIContext = createContext<UseLiveAPIResults | undefined>(undefined);

export type LiveAPIProviderProps = {
	children: ReactNode;
	url?: string;
	// apiKey: string;
};

export const LiveAPIProvider: FC<LiveAPIProviderProps> = ({
	children,
	url,
	// apiKey,
}) => {
	const liveAPI = useLiveAPI({ url });

	return (
		<LiveAPIContext.Provider value={liveAPI}>
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
