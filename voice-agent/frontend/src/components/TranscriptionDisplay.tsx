import { Bot, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface TranscriptProps {
	isConnected: boolean;
}

interface Message {
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
}

/*
export const TranscriptionDisplay = () => {
	const { transcriptionText, ws } = useContext(LiveAPIContext);
	useEffect(() => {
		if (transcriptionText && ws) {
			ws.send(
				JSON.stringify({
					type: 'transcription_update',
					text: transcriptionText,
				}),
			);
		}
	}, [transcriptionText, ws]);

	return (
		<div className="p-4 bg-white rounded shadow">
			<h2 className="text-lg font-semibold mb-2">音声認識結果</h2>
			<p className="text-gray-700 whitespace-pre-wrap leading-none">
				{transcriptionText}
			</p>
		</div>
	);
};
*/

export default function Transcript({ isConnected }: TranscriptProps) {
	const [messages, setMessages] = useState<Message[]>([]);
	const transcriptRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isConnected) {
			setMessages([
				{
					role: 'assistant',
					content: 'Hello! How can I assist you today?',
					timestamp: new Date(),
				},
			]);
		} else {
			setMessages([]);
		}
	}, [isConnected]);

	useEffect(() => {
		if (transcriptRef.current) {
			transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
		}
	}, [transcriptRef]);

	return (
		<div className="h-full flex flex-col">
			<div
				ref={transcriptRef}
				className="flex-grow overflow-auto mb-4 space-y-4"
			>
				{messages.map((message, index) => (
					<div
						key={index}
						className={`flex items-start space-x-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
					>
						{message.role === 'assistant' && (
							<Bot className="w-6 h-6 mt-1 text-green-500" />
						)}
						<div
							className={`max-w-[70%] p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-100' : 'bg-green-100'}`}
						>
							<p className="text-sm">{message.content}</p>
							<p className="text-xs text-gray-500 mt-1">
								{message.timestamp.toLocaleTimeString()}
							</p>
						</div>
						{message.role === 'user' && (
							<User className="w-6 h-6 mt-1 text-blue-500" />
						)}
					</div>
				))}
			</div>
		</div>
	);
}
