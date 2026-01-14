import { useState, useEffect } from 'react';
import { useSettings } from '../store';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: Props) {
  const { apiKey, models, botName, setApiKey, setModels, setBotName } = useSettings();
  const [localKey, setLocalKey] = useState('');
  const [localModels, setLocalModels] = useState('');
  const [localBot, setLocalBot] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalKey(apiKey);
      setLocalModels(models.join('\n'));
      setLocalBot(botName);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, apiKey, models, botName]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleApiKeyChange = (val: string) => {
    setLocalKey(val);
    setApiKey(val);
  };

  const handleModelsChange = (val: string) => {
    setLocalModels(val);
    const parsed = val.split('\n').map(m => m.trim()).filter(Boolean);
    if (parsed.length) setModels(parsed);
  };

  const handleBotNameChange = (val: string) => {
    setLocalBot(val);
    setBotName(val);
  };

  if (!isOpen) return null;

  const hasKey = !!apiKey;

  return (
    <div className="modal-overlay open" onClick={handleOverlayClick}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            Configuracoes LLM
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-field">
            <label>
              Gemini API Key{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" style={{ color: 'var(--accent)', fontWeight: 400 }}>
                (obter)
              </a>
            </label>
            <div className="api-key-row">
              <input
                type={showKey ? 'text' : 'password'}
                value={localKey}
                onChange={e => handleApiKeyChange(e.target.value)}
                placeholder="Cole sua API key aqui"
              />
              <button className="btn btn-ghost" onClick={() => setShowKey(!showKey)} title="Mostrar/ocultar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
            <div className={`api-status ${hasKey ? 'set' : 'missing'}`} style={{ marginTop: '0.5rem' }}>
              {hasKey ? '\u2713 Configurado' : '\u26A0 Sem API key'}
            </div>
          </div>
          <div className="modal-field">
            <label>Modelos (um por linha, ordem de prioridade)</label>
            <textarea
              rows={3}
              value={localModels}
              onChange={e => handleModelsChange(e.target.value)}
              placeholder="gemini-2.0-flash&#10;gemini-2.5-flash"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}
            />
          </div>
          <div className="modal-field">
            <label>Bot de donates</label>
            <input
              type="text"
              value={localBot}
              onChange={e => handleBotNameChange(e.target.value)}
              placeholder="livepix"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Feito</button>
        </div>
      </div>
    </div>
  );
}
