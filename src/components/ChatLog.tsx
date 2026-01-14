import { useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';

export function ChatLog() {
  const messages = useChat();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return <div className="empty">Mensagens do chat aparecerão aqui...</div>;
  }

  return (
    <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }}>
      {messages.map((m, i) => (
        <div key={i} className={`chat-msg${m.isDonate ? ' donate' : ''}`}>
          <span
            className={`chat-user${m.isDonate ? ' donate' : ''}`}
            style={!m.isDonate && m.color ? { color: m.color } : undefined}
          >
            {m.user}:
          </span>
          <span className="chat-text">{m.message}</span>
        </div>
      ))}
    </div>
  );
}
