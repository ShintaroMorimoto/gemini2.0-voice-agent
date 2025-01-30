import { Button } from '@/components/ui/button';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { AudioRecorder } from '@/lib/audio-recorder';
import { Mic, MicOff, Power } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

interface ControlPanelProps {
	isConnected: boolean;
	setIsConnected: (isConnected: boolean) => void;
	isMicOn: boolean;
	setIsMicOn: (isMicOn: boolean) => void;
}

function ControlPanel({
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
			setStatus('Connected, Mic On');
		} else {
			setStatus('Connected, Mic Off');
		}
	};

	return (
		<div className="flex flex-col h-full">
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 w-full">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								onClick={handleConnect}
								className={`w-full transition-colors ${
									isConnected
										? 'bg-green-500 hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800'
										: 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-800'
								}`}
								disabled={isLoading}
							>
								{isLoading ? (
									<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
								) : (
									<Power className="mr-2 h-4 w-4" />
								)}
								{isConnected ? 'Disconnect' : 'Connect'}
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>
								{isConnected
									? 'End the conversation'
									: 'Start a new conversation'}
							</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								onClick={handleMicToggle}
								className={`w-full transition-colors ${
									isMicOn
										? 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800'
										: 'bg-gray-500 hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-800'
								}`}
								disabled={!isConnected}
							>
								{isMicOn ? (
									<MicOff className="mr-2 h-4 w-4" />
								) : (
									<Mic className="mr-2 h-4 w-4" />
								)}
								{isMicOn ? 'Mic Off' : 'Mic On'}
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>
								{isMicOn ? 'Turn off the microphone' : 'Turn on the microphone'}
							</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
			<div className="mb-4 text-sm font-medium text-gray-600 dark:text-gray-400">
				Status: {status}
			</div>
		</div>
	);
}

export default memo(ControlPanel);
