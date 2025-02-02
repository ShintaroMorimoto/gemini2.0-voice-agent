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
		<div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4 md:p-8">
			<LiveAPIProvider url={uri}>
				<div className="mx-auto max-w-6xl grid gap-6 md:grid-cols-[300px_1fr]">
					<div className="space-y-6">
						<h1 className="text-xl font-bold text-slate-100 mb-4">
							Voice Agent
						</h1>
						<div className="bg-slate-900/50 border-slate-800 rounded-lg p-4">
							<ControlPanel
								isConnected={isConnected}
								setIsConnected={setIsConnected}
								isMicOn={isMicOn}
								setIsMicOn={setIsMicOn}
							/>
						</div>
						<div className="bg-slate-900/50 border-slate-800 rounded-lg p-4">
							<Summarizer />
						</div>
					</div>
					<div className="pt-[3.25rem]">
						<div className="bg-slate-900/50 border-slate-800 rounded-lg h-full">
							<TranscriptionDisplay />
						</div>
					</div>
				</div>
			</LiveAPIProvider>
		</div>
	);
}

export default App;
