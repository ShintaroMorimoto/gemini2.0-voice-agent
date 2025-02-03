import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { AudioRecorder } from '@/lib/audio-recorder';
import { Mic, MicOff, Power } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ControlPanelProps {
	isConnected: boolean;
	setIsConnected: (isConnected: boolean) => void;
	isMicOn: boolean;
	setIsMicOn: (isMicOn: boolean) => void;
}

export default function ControlPanel({
	isConnected,
	setIsConnected,
	isMicOn,
	setIsMicOn,
}: ControlPanelProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [status, setStatus] = useState<string>('Disconnected');
	const [audioRecorder] = useState(() => new AudioRecorder());
	const { client, connected, connect, disconnect } = useLiveAPIContext();

	useEffect(() => {
		const onData = (base64: string) => {
			client?.sendRealtimeInput([
				{
					mimeType: 'audio/pcm;rate=16000',
					data: base64,
				},
			]);
		};
		if (connected && isMicOn && audioRecorder) {
			audioRecorder.on('data', onData).start();
		} else {
			audioRecorder.stop();
		}
		return () => {
			audioRecorder.off('data', onData);
		};
	}, [connected, client, isMicOn, audioRecorder]);

	const handleConnect = async () => {
		setIsLoading(true);
		try {
			if (!isConnected) {
				await connect();
				setIsConnected(true);
				setStatus('Connected');
			} else {
				await disconnect();
				setIsConnected(false);
				setStatus('Disconnected');
				setIsMicOn(false);
			}
		} catch (error) {
			console.error('Connection error:', error);
			setStatus('Error');
		} finally {
			setIsLoading(false);
		}
	};

	const handleMicToggle = () => {
		setIsMicOn(!isMicOn);
		if (!isMicOn) {
			setStatus('Connected, Mic is now On');
		} else {
			setStatus('Connected, Mic is now Off');
		}
	};

	return (
		<div>
			<div className="flex gap-2 mb-4">
				<button
					onClick={handleConnect}
					disabled={isLoading}
					className={`flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors w-full
						${
							isConnected
								? 'bg-red-500 hover:bg-red-600 text-white'
								: 'bg-gray-800 hover:bg-gray-700 text-white'
						}`}
				>
					<Power className="h-4 w-4" />
					{isConnected ? 'Disconnect' : 'Connect'}
				</button>
				<button
					onClick={handleMicToggle}
					disabled={!isConnected}
					className={`flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors w-full
						${
							isMicOn
								? 'bg-red-500 hover:bg-red-600 text-white'
								: 'bg-gray-800 hover:bg-gray-700 text-white'
						}`}
				>
					{isMicOn ? (
						<MicOff className="h-4 w-4" />
					) : (
						<Mic className="h-4 w-4" />
					)}
					{isMicOn ? 'Mic Off' : 'Mic On'}
				</button>
			</div>
			<div className="flex items-center gap-2 text-sm text-gray-300">
				<div
					className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
				/>
				<span>Status: {status}</span>
			</div>
		</div>
	);
}
