import type { ReactNode } from "react";
import { memo, useState } from "react";
export type ControlTrayProps = {
	children?: ReactNode;
};

function ControlTray({ children }: ControlTrayProps) {
    const [audioRecorder] = useState(() = new audioRecorder());
	return <div>{children}</div>;
}

export default memo(ControlTray);
