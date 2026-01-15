import { useState } from 'react';
import { useSources, useSettings } from '../store';

type SourceType = 'donation' | 'resub' | 'chat';

const SOURCE_LABELS: Record<SourceType, string> = {
  donation: 'Doações',
  resub: 'Resubs',
  chat: 'Chat'
};

const SOURCE_DESCRIPTIONS: Record<SourceType, string> = {
  donation: 'Detectado via bot de doação',
  resub: 'Detectado via USERNOTICE',
  chat: 'Comando de chat para subs'
};

const SOURCE_ICONS: Record<SourceType, JSX.Element> = {
  donation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  resub: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
};

export function SourcesPanel() {
  const {
    enabled, chatCommand, chatTiers, priority,
    setEnabled, setChatCommand, setChatTiers, setPriority, clearSessionRequests
  } = useSources();
  const { minDonation, setMinDonation } = useSettings();

  const [isOpen, setIsOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<SourceType | null>(null);

  const handleDragStart = (source: SourceType) => {
    setDraggedItem(source);
  };

  const handleDragOver = (e: React.DragEvent, targetSource: SourceType) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetSource) return;
    const newPriority = [...priority].filter((s): s is SourceType => s !== 'manual');
    const draggedIdx = newPriority.indexOf(draggedItem);
    const targetIdx = newPriority.indexOf(targetSource);
    if (draggedIdx === -1 || targetIdx === -1) return;
    newPriority.splice(draggedIdx, 1);
    newPriority.splice(targetIdx, 0, draggedItem);
    setPriority([...newPriority, 'manual']);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const filteredPriority = priority.filter((s): s is SourceType => s !== 'manual');

  const renderSourceCard = (source: SourceType) => {
    const isEnabled = enabled[source];

    return (
      <div
        key={source}
        className={`source-card ${source} ${isEnabled ? 'enabled' : 'disabled'}`}
      >
        <div className="source-card-header">
          <div className="source-card-info">
            <span className="source-card-icon">{SOURCE_ICONS[source]}</span>
            <div className="source-card-text">
              <span className="source-card-title">{SOURCE_LABELS[source]}</span>
              <span className="source-card-desc">{SOURCE_DESCRIPTIONS[source]}</span>
            </div>
          </div>
          <label className="source-card-toggle">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={e => setEnabled({ ...enabled, [source]: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {source === 'donation' && isEnabled && (
          <div className="source-card-body">
            <div className="source-card-row">
              <label className="source-card-label">Mínimo</label>
              <div className="min-donation-input">
                <span className="min-donation-prefix">R$</span>
                <input
                  type="number"
                  className="source-card-input"
                  value={minDonation}
                  min={0}
                  step={1}
                  onChange={e => setMinDonation(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        )}

        {source === 'chat' && isEnabled && (
          <div className="source-card-body">
            <div className="source-card-row">
              <label className="source-card-label">Comando</label>
              <input
                type="text"
                className="source-card-input"
                value={chatCommand}
                placeholder="!request"
                onChange={e => setChatCommand(e.target.value.trim() || '!request')}
              />
            </div>
            <div className="source-card-row">
              <label className="source-card-label">Tiers</label>
              <div className="tier-pills">
                {[1, 2, 3].map(tier => (
                  <button
                    key={tier}
                    className={`tier-pill ${chatTiers.includes(tier) ? 'active' : ''}`}
                    onClick={() => {
                      const newTiers = chatTiers.includes(tier)
                        ? chatTiers.filter(t => t !== tier)
                        : [...chatTiers, tier];
                      setChatTiers(newTiers);
                    }}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={clearSessionRequests}>
              Nova Stream
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className={`sources-panel ${isOpen ? 'open' : ''}`} id="sourcesPanel">
      <div className="sources-panel-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="sources-panel-title">Fontes de Pedidos</span>
        <span className="sources-panel-toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>

      <div className="sources-panel-body">
        <div className="source-cards">
          {(['donation', 'resub', 'chat'] as SourceType[]).map(renderSourceCard)}
        </div>

        <div className="priority-section">
          <div className="priority-header">Prioridade</div>
          <div className="priority-pills">
            {filteredPriority.map((source, idx) => (
              <div
                key={source}
                className={`priority-pill ${source} ${draggedItem === source ? 'dragging' : ''}`}
                draggable
                onDragStart={() => handleDragStart(source)}
                onDragOver={e => handleDragOver(e, source)}
                onDragEnd={handleDragEnd}
              >
                <span className="priority-pill-num">{idx + 1}</span>
                <span className="priority-pill-icon">{SOURCE_ICONS[source]}</span>
                <span className="priority-pill-label">{SOURCE_LABELS[source]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
