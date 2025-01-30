import { useState } from 'react';
import ControlPanel from './components/ControlPanel';
import { Summarizer } from './components/Summarizer';
// import { TranscriptionDisplay } from './components/TranscriptionDisplay';
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
		<>
			<h1>Voice Agent</h1>
			<div className="flex h-screen bg-gray-900">
				<div className="w-1/3 p-4 bg-gray-800 shadow-md">
					<div className="mb-4">
						<h1 className="text-2xl font-bold text-gray-200">
							AI Transcription
						</h1>
					</div>
					<LiveAPIProvider url={uri}>
						<ControlPanel
							isConnected={isConnected}
							setIsConnected={setIsConnected}
							isMicOn={isMicOn}
							setIsMicOn={setIsMicOn}
						/>
						{/* <TranscriptionDisplay /> */}
						<Summarizer />
					</LiveAPIProvider>
				</div>
			</div>
		</>
	);
}

export default App;
