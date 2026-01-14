import { ChatLog } from './components/ChatLog';
import { ControlPanel } from './components/ControlPanel';
import { DebugPanel } from './components/DebugPanel';
import { DonationList } from './components/DonationList';
import { SettingsModal } from './components/SettingsModal';
import { SourcesPanel } from './components/SourcesPanel';
import { Stats } from './components/Stats';
import { ToastContainer } from './components/ToastContainer';
import { useRequests } from './hooks/useRequests';
import { useState, useEffect, useRef, useCallback } from 'react';

export function App() {
  const requests = useRequests();
  const pendingCount = requests.filter(d => !d.done && !d.belowThreshold).length;
  const clearDoneRef = useRef<(() => void) | null>(null);
  const [chatHidden, setChatHidden] = useState(() =>
    localStorage.getItem('dbd_chat_hidden') === 'true'
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  useEffect(() => {
    localStorage.setItem('dbd_chat_hidden', String(chatHidden));
  }, [chatHidden]);

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

        <ControlPanel onOpenSettings={openSettings} />

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
          <div>Monitorando doações via <strong style={{ color: 'var(--accent)' }} id="footerBotName">livepix</strong></div>
          <a href="https://github.com/macecchi/mandy-utils" target="_blank">GitHub</a>
        </footer>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={closeSettings} />
      <ToastContainer />
    </>
  );
}
