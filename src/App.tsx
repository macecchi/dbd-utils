import { useState, useEffect, useRef } from 'react';
import { ChatLog } from './components/ChatLog';
import { ControlPanel } from './components/ControlPanel';
import { DebugPanel } from './components/DebugPanel';
import { DonationList } from './components/DonationList';
import { SettingsModal } from './components/SettingsModal';
import { SourcesPanel } from './components/SourcesPanel';
import { Stats } from './components/Stats';
import { ToastContainer } from './components/ToastContainer';
import { connect, identifyCharacter } from './services';
import { useRequests, useSettings, useTwitch } from './store';

export function App() {
  const requests = useRequests((s) => s.requests);
  const update = useRequests((s) => s.update);
  const { apiKey, models, botName } = useSettings();
  const { channel, chatHidden, setChatHidden } = useTwitch();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const clearDoneRef = useRef<(() => void) | null>(null);

  // Auto-identify requests that need it
  useEffect(() => {
    const pending = requests.filter(r => r.needsIdentification);
    for (const req of pending) {
      identifyCharacter(req, { apiKey, models }).then(result => {
        update(req.id, { ...result, needsIdentification: false });
      });
    }
  }, [requests, apiKey, models, update]);

  // Auto-connect on mount if channel is set
  useEffect(() => {
    if (channel) {
      const timer = setTimeout(() => connect(), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const pendingCount = requests.filter(d => !d.done && !d.belowThreshold).length;

  return (
    <>
      <div className="app">
        <header className="header">
          <div className="brand">
            <div className="brand-icon">
              <img src="images/Dead-by-Daylight-Emblem.png" alt="DBD" />
            </div>
            <h1>DBD Tracker<span>Fila de pedidos</span></h1>
          </div>
          <Stats />
        </header>

        <ControlPanel onOpenSettings={() => setSettingsOpen(true)} />

        <main className={`grid${chatHidden ? ' chat-hidden' : ''}`}>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <img src="images/IconHelpLoading_players.webp" />
                Fila
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button className="btn btn-ghost btn-small" onClick={() => clearDoneRef.current?.()}>
                  Limpar feitos
                </button>
                {chatHidden && (
                  <button className="btn btn-ghost btn-small" onClick={() => setChatHidden(false)}>
                    Mostrar chat
                  </button>
                )}
                <span className="panel-count">{pendingCount}</span>
              </div>
            </div>
            <div className="panel-body">
              <DonationList onClearDoneRef={clearDoneRef} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                Chat ao Vivo
              </div>
              <button className="btn btn-ghost btn-small" onClick={() => setChatHidden(true)}>
                Esconder
              </button>
            </div>
            <div className="panel-body chat-body">
              <ChatLog />
            </div>
          </div>
        </main>

        <SourcesPanel />
        <DebugPanel />

        <footer className="footer">
          <div>Monitorando doações via <strong style={{ color: 'var(--accent)' }}>{botName}</strong></div>
          <a href="https://github.com/macecchi/mandy-utils" target="_blank">GitHub</a>
        </footer>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ToastContainer />
    </>
  );
}
