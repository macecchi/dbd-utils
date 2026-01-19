import { useState } from 'react';
import { useSettings, useAuth, useChannel } from '../store';

interface Props {
  onOpenSettings: () => void;
}

export function ControlPanel({ onOpenSettings }: Props) {
  const { channel } = useChannel();
  const { status, statusText, isLLMEnabled } = useSettings();
  const { user, isAuthenticated, login, logout } = useAuth();
  const llmEnabled = isLLMEnabled();
  const isOwnChannel = isAuthenticated && user && channel.toLowerCase() === user.login.toLowerCase();

  const [channelInput, setChannelInput] = useState(channel);

  const handleChangeChannel = () => {
    const ch = channelInput.trim().toLowerCase();
    if (ch && ch !== channel) {
      window.location.hash = `#/${ch}`;
    }
  };

  const handleMyQueue = () => {
    if (!isAuthenticated) {
      login();
    } else if (user) {
      window.location.hash = `#/${user.login.toLowerCase()}`;
    }
  };

  return (
    <section className="controls">
      <div className="field grow channel">
        <label>Canal Twitch</label>
        <input
          type="text"
          value={channelInput}
          placeholder="canal"
          onChange={e => setChannelInput(e.target.value)}
          onBlur={handleChangeChannel}
          onKeyDown={e => e.key === 'Enter' && handleChangeChannel()}
        />
      </div>
      {isOwnChannel ? (
        <div className="channel auth-info">
          <img src={user.profile_image_url} alt={user.display_name} className="avatar" />
          <span>{user.display_name}</span>
          <button className="btn btn-ghost" onClick={logout}>Sair</button>
        </div>
      ) : (
        <button className="btn" onClick={handleMyQueue}>
          {isAuthenticated ? 'Minha fila' : 'Criar minha fila'}
        </button>
      )}
      <button className="btn btn-icon" onClick={onOpenSettings} title="Configurações IA">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
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
