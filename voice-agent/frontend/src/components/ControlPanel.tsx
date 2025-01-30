import { Button } from '@/components/ui/button';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { Mic, MicOff, Power } from 'lucide-react';
import { memo, useState } from 'react';

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
	const [summary, setSummary] = useState<string>('No conversation yet.');
	const [isLoading, setIsLoading] = useState(false);
	const [status, setStatus] = useState<string>('Disconnected');

	const handleConnect = () => {
		setIsLoading(true);
		setTimeout(() => {
			setIsConnected(!isConnected);
			setIsLoading(false);
			if (!isConnected) {
				setSummary('Connection established. Ready for conversation.');
				setStatus('Connected');
			} else {
				setSummary('Connection closed.');
				setStatus('Disconnected');
				setIsMicOn(false);
			}
		}, 1500);
	};

	const handleMicToggle = () => {
		setIsMicOn(!isMicOn);
		if (!isMicOn) {
			setSummary('Microphone is now on. Start speaking.');
			setStatus('Connected, Mic On');
		} else {
			setSummary('Microphone is off.');
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
			<div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md flex-grow overflow-auto">
				<h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
					Conversation Summary
				</h2>
				<p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
					{summary}
				</p>
			</div>
		</div>
	);
}

export default memo(ControlPanel);
