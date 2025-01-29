import { Summarizer } from "./components/Summarizer";
import { TranscriptionDisplay } from "./components/TranscriptionDisplay";
import ControlTray from "./components/control-tray/ControlTray";
import { LiveAPIProvider } from "./contexts/LiveAPIContext";

const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const uri =
	process.env.NODE_ENV === "production"
		? `${protocol}//${window.location.host}/ws`
		: "ws://localhost:3000/ws";

function App() {
	return (
		<>
			<h1>Voice Agent</h1>
			<LiveAPIProvider url={uri}>
				<main>
					<ControlTray />
					<TranscriptionDisplay />
					<Summarizer />
				</main>
			</LiveAPIProvider>
		</>
	);
}

export default App;
