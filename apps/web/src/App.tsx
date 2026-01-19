import { useState, useEffect } from 'react';
import { ChatLog } from './components/ChatLog';
import { ControlPanel } from './components/ControlPanel';
import { DebugPanel } from './components/DebugPanel';
import { CharacterRequestList } from './components/CharacterRequestList';
import { ManualEntry } from './components/ManualEntry';
import { SettingsModal } from './components/SettingsModal';
import { SourcesPanel } from './components/SourcesPanel';
import { Stats } from './components/Stats';
import { ToastContainer } from './components/ToastContainer';
import { connect, disconnect, identifyCharacter } from './services';
import { useSettings, useAuth, ChannelProvider, useChannel, useToasts, useLastChannel } from './store';
import { migrateGlobalToChannel } from './utils/migrate';

const getChannelFromHash = (hash: string) => hash.replace(/^#\/?/, '') || null;

function ChannelApp() {
  const { useRequests, useSources } = useChannel();
  const requests = useRequests((s) => s.requests);
  const update = useRequests((s) => s.update);
  const { apiKey, models, botName, chatHidden, setChatHidden } = useSettings();
  const { show } = useToasts();
  const sortMode = useSources((s) => s.sortMode);
  const setSortMode = useSources((s) => s.setSortMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize existing requests so they don't trigger toasts on load
  useEffect(() => {
    if (!isInitialized && requests.length > 0) {
      const pendingNotification = requests.filter(r => !r.toastShown && !r.needsIdentification);
      for (const req of pendingNotification) {
        update(req.id, { toastShown: true });
      }
      setIsInitialized(true);
    } else if (!isInitialized && requests.length === 0) {
      setIsInitialized(true);
    }
  }, [requests, update, isInitialized]);

  // Auto-identify requests that need it
  useEffect(() => {
    const pending = requests.filter(r => r.needsIdentification);
    for (const req of pending) {
      identifyCharacter(
        req,
        { apiKey, models },
        undefined,
        (llmResult) => update(req.id, llmResult)
      ).then(result => {
        update(req.id, { ...result, needsIdentification: false });
      });
    }
  }, [requests, apiKey, models, update]);

  // Handle toasts for ready requests
  useEffect(() => {
    if (!isInitialized) return;

    const readyToToast = requests.filter(r => !r.toastShown && !r.needsIdentification);
    for (const req of readyToToast) {
      const title = req.source === 'manual' ? 'Novo pedido' :
        req.source === 'donation' ? 'Novo pedido por donate' :
          req.source === 'resub' ? 'Novo pedido por resub' : 'Novo pedido pelo chat';

      const message = req.character
        ? `${req.donor} pediu ${req.character}${req.amount ? ` (${req.amount})` : ''}`
        : `Novo pedido de ${req.donor}${req.amount ? ` (${req.amount})` : ''}`;

      show(message, title);
      update(req.id, { toastShown: true });
    }
  }, [requests, update, show, isInitialized]);

  const pendingCount = requests.filter(d => !d.done).length;

  return (
    <>
      <div className="app">
        <header className="header">
          <div className="brand">
            <div className="brand-icon">
              <img src={`${import.meta.env.BASE_URL}images/Dead-by-Daylight-Emblem.png`} alt="DBD" />
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
                <img src={`${import.meta.env.BASE_URL}images/IconPlayers.webp`} />
                Fila
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => setSortMode(sortMode === 'fifo' ? 'priority' : 'fifo')}
                  title={`${sortMode === 'fifo' ? 'Novos pedidos entram no final' : 'Novos pedidos entram por prioridade de fonte'}. Clique para alternar.`}
                >
                  {sortMode === 'fifo' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M3 12h12M3 18h6" />
                    </svg>
                  )}
                  Ordem: {sortMode === 'fifo' ? 'chegada' : 'prioridade'}
                </button>
                <button className="btn btn-ghost btn-small btn-small-icon" onClick={() => setManualOpen(true)} title="Adicionar novo pedido">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                <button className={`btn btn-ghost btn-small btn-small-icon${showDone ? ' active' : ''}`} onClick={() => setShowDone(v => !v)} title={showDone ? 'Esconder feitos' : 'Mostrar feitos'}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showDone ? <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /> : <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />}
                    <circle cx="12" cy="12" r="3" style={{ display: showDone ? 'block' : 'none' }} />
                    {!showDone && <line x1="1" y1="1" x2="23" y2="23" />}
                  </svg>
                </button>
                {chatHidden && (
                  <button className="btn btn-ghost btn-small btn-small-icon" onClick={() => setChatHidden(false)} title="Mostrar chat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </button>
                )}
                <span className="panel-count">{pendingCount}</span>
              </div>
            </div>
            <div className="panel-body">
              <CharacterRequestList showDone={showDone} />
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
              <button className="btn btn-ghost btn-small btn-small-icon" onClick={() => setChatHidden(true)} title="Esconder chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="panel-body chat-body">
              <ChatLog />
            </div>
          </div>
        </main>

        <SourcesPanel />
        {window.location.hash.includes('debug') && <DebugPanel />}

        <footer className="footer">
          <div>Monitorando doações via <strong style={{ color: 'var(--accent)' }}>{botName}</strong></div>
          <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span>Versão: {__APP_VERSION__}</span>
            <span className="footer-separator">•</span>
            <a href="https://github.com/macecchi/dbd-utils" target="_blank">GitHub</a>
          </span>
        </footer>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ManualEntry isOpen={manualOpen} onClose={() => setManualOpen(false)} />
      <ToastContainer />
    </>
  );
}

function LandingPage({ onConnect }: { onConnect: (channel: string) => void }) {
  const { lastChannel } = useLastChannel();
  const [channelInput, setChannelInput] = useState(lastChannel);
  const { user, isAuthenticated, login, logout, handleCallback } = useAuth();
  const { status, statusText, isLLMEnabled } = useSettings();
  const llmEnabled = isLLMEnabled();

  // Handle OAuth callback
  useEffect(() => {
    const success = handleCallback();
    if (success) {
      const freshUser = useAuth.getState().user;
      if (freshUser?.login) {
        onConnect(freshUser.login);
      }
    }
  }, [handleCallback, onConnect]);

  const handleConnect = () => {
    const ch = channelInput.trim();
    if (ch) onConnect(ch);
  };

  const handleCreateQueue = () => {
    if (!isAuthenticated) {
      login();
    } else if (user) {
      onConnect(user.login);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">
            <img src={`${import.meta.env.BASE_URL}images/Dead-by-Daylight-Emblem.png`} alt="DBD" />
          </div>
          <h1>DBD Tracker<span>Fila de pedidos</span></h1>
        </div>
      </header>
      <section className="controls">
        {isAuthenticated && user ? (
          <div className="channel auth-info">
            <img src={user.profile_image_url} alt={user.display_name} className="avatar" />
            <span>{user.display_name}</span>
            <button className="btn btn-primary" onClick={() => onConnect(user.login)}>
              Abrir minha fila
            </button>
            <button className="btn btn-ghost" onClick={logout}>Sair</button>
          </div>
        ) : (
          <>
            <div className="field grow channel">
              <label>Canal Twitch</label>
              <input
                type="text"
                value={channelInput}
                placeholder="canal"
                onChange={e => setChannelInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
              />
            </div>
            <button className="btn btn-primary" onClick={handleConnect}>
              Conectar
            </button>
            <button className="btn" onClick={handleCreateQueue}>
              Criar minha fila
            </button>
          </>
        )}
        <div className="status-block">
          <div className="status-row">
            <span className={`status-dot ${status}`} />
            <span>{statusText}</span>
          </div>
          <div className="status-row">
            <span className={`status-dot ${llmEnabled ? 'connected' : ''}`} />
            <span>{llmEnabled ? 'IA configurada' : 'IA não configurada'}</span>
          </div>
        </div>
      </section>
      <ToastContainer />
    </div>
  );
}

export function App() {
  const { handleCallback } = useAuth();
  const [channel, setChannel] = useState<string | null>(null);

  // Handle migration and initial channel on mount
  useEffect(() => {
    // Run migration first
    const migratedChannel = migrateGlobalToChannel();

    // Handle OAuth callback
    const success = handleCallback();
    if (success) {
      const freshUser = useAuth.getState().user;
      if (freshUser?.login) {
        window.location.hash = `#/${freshUser.login}`;
        setChannel(freshUser.login.toLowerCase());
        return;
      }
    }

    // Set channel from hash or migration
    const hashChannel = getChannelFromHash(window.location.hash);
    if (hashChannel) {
      setChannel(hashChannel.toLowerCase());
    } else if (migratedChannel) {
      window.location.hash = `#/${migratedChannel}`;
      setChannel(migratedChannel);
    }
  }, [handleCallback]);

  // Handle hashchange
  useEffect(() => {
    const onHashChange = () => {
      const hashChannel = getChannelFromHash(window.location.hash);
      if (hashChannel) {
        setChannel(hashChannel.toLowerCase());
      } else {
        setChannel(null);
        disconnect();
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Connect when channel is set
  useEffect(() => {
    if (channel) {
      connect(channel);
    }
  }, [channel]);

  const handleConnect = (ch: string) => {
    const normalized = ch.toLowerCase();
    useLastChannel.getState().setLastChannel(normalized);
    window.location.hash = `#/${normalized}`;
    setChannel(normalized);
  };

  if (!channel) {
    return <LandingPage onConnect={handleConnect} />;
  }

  return (
    <ChannelProvider channel={channel}>
      <ChannelApp />
    </ChannelProvider>
  );
}
