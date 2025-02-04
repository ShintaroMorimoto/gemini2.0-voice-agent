import { useLiveAPI } from '@/hooks/use-live-api';
import type { MultimodalLiveClient } from '@/lib/multimodal-live-client';
import {
    type ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from 'react';

export type LiveAPIContextType = {
	client: MultimodalLiveClient | null;
	connected: boolean;
	transcriptionText: string;
	setTranscriptionText: (text: string) => void;
	summaryText: string;
	setSummaryText: (text: string) => void;
	connect: () => Promise<void>;
	disconnect: () => Promise<void>;
	ws: WebSocket | null;
};

export const LiveAPIContext = createContext<LiveAPIContextType>({
	client: null,
	connected: false,
	transcriptionText: '',
	setTranscriptionText: () => {},
	summaryText: '',
	setSummaryText: () => {},
	connect: async () => {},
	disconnect: async () => {},
	ws: null,
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
	const [transcriptionText, setTranscriptionText] = useState('');
	const [summaryText, setSummaryText] = useState('');
	const [ws, setWs] = useState<WebSocket | null>(null);
	const {
		client,
		connect: connectClient,
		disconnect: disconnectClient,
	} = useLiveAPI({
		url,
		setTranscriptionText,
		setSummaryText,
	});

	useEffect(() => {
		// WebSocket接続を作成
		const websocket = new WebSocket(url);

		websocket.onopen = () => {
			console.log('WebSocket connected');
			setWs(websocket);
		};

		websocket.onerror = (error) => {
			console.error('WebSocket error:', error);
		};

		websocket.onclose = () => {
			console.log('WebSocket disconnected');
			setWs(null);
		};

		return () => {
			websocket.close();
		};
	}, [url]);

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
				summaryText,
				setSummaryText,
				connect,
				disconnect,
				ws,
			}}
		>
			{children}
		</LiveAPIContext.Provider>
	);
};

export const useLiveAPIContext = () => {
	const context = useContext(LiveAPIContext);
	if (!context) {
		throw new Error('useLiveAPIContext must be used within a LiveAPIProvider');
	}
	return context;
};
