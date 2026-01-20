import { useState, useEffect } from 'react';
import { useSettings, useAuth, useChannel } from '../store';
import { connect, disconnect } from '../services/twitch';
import type { ConnectionState } from '../types';


export function ControlPanel() {
  const { channel, isOwnChannel, useRequests, useSources } = useChannel();
  const { status } = useSettings();
  const { user, isAuthenticated, login, logout } = useAuth();
  const partyConnected = useRequests((s) => s.partyConnected);
  const ircConnected = useSources((s) => s.ircConnected);
  const takingRequests = useSources((s) => s.isTakingRequests());

  // For viewers: derive status from partyConnected + ircConnected
  const viewerStatus: ConnectionState = !partyConnected ? 'connecting' : ircConnected ? 'connected' : 'disconnected';
  const viewerStatusText = !partyConnected ? 'Conectando...' : ircConnected ? 'Streamer online' : 'Streamer offline';

  const [channelInput, setChannelInput] = useState(channel);

  // Sync input when channel changes from elsewhere
  useEffect(() => {
    setChannelInput(channel);
  }, [channel]);

  const inputChannel = channelInput.trim().toLowerCase();
  const isSameChannel = inputChannel === channel;
  const isConnected = status === 'connected' && isSameChannel;
  const isConnecting = status === 'connecting';

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
    } else if (inputChannel) {
      if (inputChannel !== channel) {
        window.location.hash = `#/${inputChannel}`;
      } else {
        connect(channel);
      }
    }
  };

  const handleGoToChannel = () => {
    if (inputChannel && inputChannel !== channel) {
      window.location.hash = `#/${inputChannel}`;
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
        <div className="channel-input">
          {isOwnChannel && user && (
            <img src={user.profile_image_url} alt={user.display_name} className="avatar" />
          )}
          <input
            type="text"
            value={channelInput}
            placeholder="canal"
            onChange={e => setChannelInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (isOwnChannel ? handleConnect() : handleGoToChannel())}
          />
        </div>
      </div>
      {isOwnChannel ? (
        <>
          <button
            className={`btn btn-primary ${isConnected ? 'connected' : ''}`}
            onClick={handleConnect}
            disabled={isConnecting || !inputChannel}
          >
            {isConnecting ? 'Conectando...' : isConnected ? 'Desconectar' : 'Conectar'}
          </button>
          <div className="channel auth-info">
            <button className="btn btn-ghost" onClick={logout}>Sair</button>
          </div>
        </>
      ) : (
        <>
          {inputChannel !== channel && (
            <button className="btn btn-primary" onClick={handleGoToChannel}>
              Ir
            </button>
          )}
          <button className="btn" onClick={handleMyQueue}>
            {isAuthenticated ? 'Minha fila' : 'Criar minha fila'}
          </button>
        </>
      )}
      <div className="status-block">
        <div className="status-row">
          <span className={`status-dot ${viewerStatus}`} />
          <span>{viewerStatusText}</span>
        </div>
        <div className="status-row">
          <span className={`status-dot ${takingRequests ? 'connected' : ''}`} />
          <span>{takingRequests ? 'Fila aberta' : 'Fila fechada'}</span>
        </div>
      </div>
    </section>
  );
}
