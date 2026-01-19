import { useSettings, useAuth } from '../store';
import { connect, disconnect } from '../services';

interface Props {
  onOpenSettings: () => void;
}

export function ControlPanel({ onOpenSettings }: Props) {
  const { channel, status, statusText, setChannel, isLLMEnabled } = useSettings();
  const { user, isAuthenticated, login, logout } = useAuth();
  const isConnected = status === 'connected';
  const llmEnabled = isLLMEnabled();

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  const handleCreateQueue = () => {
    if (!isAuthenticated) {
      login();
    } else if (user) {
      setChannel(user.login);
      connect();
    }
  };

  return (
    <section className="controls">
      <div className="field grow">
        <label>Canal Twitch</label>
        <input
          type="text"
          value={channel}
          placeholder="canal"
          onChange={e => setChannel(e.target.value)}
        />
      </div>
      <button
        className={`btn btn-primary${isConnected ? ' connected' : ''}`}
        onClick={handleConnect}
      >
        {isConnected ? 'Desconectar' : 'Conectar'}
      </button>
      <button className="btn btn-icon" onClick={onOpenSettings} title="Configurações IA">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
      {isAuthenticated && user ? (
        <div className="auth-info">
          <img src={user.profile_image_url} alt={user.display_name} className="avatar" />
          <span>{user.display_name}</span>
          <button className="btn btn-text" onClick={logout}>Sair</button>
        </div>
      ) : (
        <button className="btn" onClick={handleCreateQueue}>
          Criar minha fila
        </button>
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
  );
}
