import { useState, useEffect } from 'react';
import { useSettings, useAuth, useChannel } from '../store';
import { connect, disconnect } from '../services/twitch';
import { useConnectionStatus } from '../hooks/useConnectionStatus';


export function ControlPanel() {
  const { channel, canManageChannel, useChannelInfo } = useChannel();
  const twitchStatus = useChannelInfo((s) => s.localIrcConnectionState);
  const { user, isAuthenticated, login, logout } = useAuth();
  const { connection, queue } = useConnectionStatus();
  const owner = useChannelInfo((s) => s.owner);

  const [channelInput, setChannelInput] = useState(channel);

  // Sync input when channel changes from elsewhere
  useEffect(() => {
    setChannelInput(channel);
  }, [channel]);

  const inputChannel = channelInput.trim().toLowerCase();
  const isSameChannel = inputChannel === channel;
  const isIrcConnected = twitchStatus === 'connected' && isSameChannel;
  const isIrcConnecting = twitchStatus === 'connecting';

  const handleConnect = () => {
    if (isIrcConnected) {
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
          {owner && (
            <img src={owner.avatar} alt={owner.displayName} className="avatar" />
          )}
          <input
            type="text"
            value={channelInput}
            placeholder="canal"
            onChange={e => setChannelInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (canManageChannel ? handleConnect() : handleGoToChannel())}
          />
        </div>
      </div>
      {canManageChannel ? (
        <>
          <button
            className={`btn btn-primary ${isIrcConnected ? 'connected' : ''}`}
            onClick={handleConnect}
            disabled={isIrcConnecting || !inputChannel}
          >
            {isIrcConnecting ? 'Conectando...' : isIrcConnected ? 'Desconectar' : 'Conectar'}
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
          <span className={`status-dot ${connection.state}`} />
          <span>{connection.text}</span>
        </div>
        <div className="status-row">
          <span className={`status-dot ${queue.state}`} />
          <span>{queue.text}</span>
        </div>
      </div>
    </section>
  );
}
