import { useState } from 'react';
import ControlPanel from './components/ControlPanel';
import { Summarizer } from './components/Summarizer';
import TranscriptionDisplay from './components/TranscriptionDisplay';
import { LiveAPIProvider } from './contexts/LiveAPIContext';

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const uri =
	process.env.NODE_ENV === 'production'
		? `${protocol}//${window.location.host}/ws`
		: 'ws://localhost:3000/ws';

function App() {
	const [isConnected, setIsConnected] = useState(false);
	const [isMicOn, setIsMicOn] = useState(false);

	return (
		<div className="flex h-screen bg-gray-900">
			<LiveAPIProvider url={uri}>
				<div className="w-1/4 p-4 bg-gray-800 flex flex-col">
					<div>
						<h1 className="text-2xl font-bold text-gray-200 mb-4">
							Voice Agent
						</h1>
						<ControlPanel
							isConnected={isConnected}
							setIsConnected={setIsConnected}
							isMicOn={isMicOn}
							setIsMicOn={setIsMicOn}
						/>
						<div className="mt-0">
							<Summarizer />
						</div>
					</div>
				</div>
				<div className="w-3/4">
					<TranscriptionDisplay />
				</div>
			</LiveAPIProvider>
		</div>
	);
}

export default App;
