import { Altair } from "./components/altair/altair";
import ControlTray from "./components/control-tray/ControlTray";
import { LiveAPIProvider } from "./contexts/LiveAPIContext";

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
