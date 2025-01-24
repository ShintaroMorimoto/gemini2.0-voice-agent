import { Altair } from "./components/altair/altair";
import ControlTray from "./components/control-tray/ControlTray";
import { LiveAPIProvider } from "./contexts/LiveAPIContext";

const API_KEY = import.meta.env.VITE_REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== "string") {
	throw new Error("REACT_APP_GEMINI_API_KEY is not set in .env");
}

// const host = "generativelanguage.googleapis.com";
// const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;
const uri = "ws://localhost:3000/ws";

function App() {
	return (
		<>
			<h1>Voice Agent</h1>
			<LiveAPIProvider url={uri}>
				<main>
					<Altair />
					<ControlTray />
				</main>
			</LiveAPIProvider>
		</>
	);
}

export default App;
