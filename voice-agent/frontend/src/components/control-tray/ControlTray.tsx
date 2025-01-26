import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { AudioRecorder } from '@/lib/audio-recorder';
import { type ReactNode, memo, useEffect, useRef, useState } from 'react';

export type ControlTrayProps = {
  children?: ReactNode;
};




function ControlTray({ children }: ControlTrayProps) {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const renderCanvasRef = useRef<HTMLCanvasElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  const { client, connected, connect, disconnect } = useLiveAPIContext();

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);

  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);
    };
    if (connected && !muted && audioRecorder) {
      audioRecorder.on('data', onData).start();
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.off('data', onData);
    };
  }, [connected, client, muted, audioRecorder]);

  return (
    <section>
      <canvas ref={renderCanvasRef} />
      <nav>
        <button type='button' onClick={() => setMuted(!muted)}>
          {!muted ? (
            <span className='material-symbols-outlined filled'>mic</span>
          ) : (
            <span className='material-symbols-outlined filled'>mic_off</span>
          )}
        </button>
        {children}
      </nav>
      <div>
        <div className='connection-button-container'>
          <button
            ref={connectButtonRef}
            type='button'
            onClick={connected ? disconnect : connect}
          >
            <span className='material-symbols-outlined filled'>
              {connected ? 'pause' : 'play_arrow'}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

export default memo(ControlTray);
