import { useState } from 'react';
import { useSources, useSettings } from '../store';
import { DEFAULTS } from '../store/sources';

type SourceType = 'donation' | 'resub' | 'chat';

const SOURCE_LABELS: Record<SourceType, string> = {
  donation: 'Donates',
  resub: 'Resubs',
  chat: 'Chat'
};

const SOURCE_DESCRIPTIONS: Record<SourceType, string> = {
  donation: 'Pedidos feitos via donate a partir do valor mínimo definido',
  resub: 'Mensagens de reinscrição',
  chat: 'Comando de chat para inscritos'
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
    enabled, chatCommand, chatTiers, priority, sortMode,
    setEnabled, setChatCommand, setChatTiers, setPriority
  } = useSources();
  const { minDonation, setMinDonation, botName, setBotName } = useSettings();

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

  const getMinTier = (): number => {
    if (chatTiers.length === 0) return 1;
    return Math.min(...chatTiers);
  };

  const setMinTier = (minTier: number) => {
    setChatTiers([1, 2, 3].filter(t => t >= minTier));
  };

  const renderSourceSection = (source: SourceType) => {
    const isEnabled = enabled[source];

    return (
      <div key={source} className={`source-section source-${source} ${isEnabled ? 'enabled' : 'disabled'}`}>
        <div className="source-section-header">
          <div className="source-section-title">
            <span className="source-section-icon">{SOURCE_ICONS[source]}</span>
            <span>{SOURCE_LABELS[source]}</span>
          </div>
          <label className="source-toggle">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={e => setEnabled({ ...enabled, [source]: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <span className="source-section-desc">{SOURCE_DESCRIPTIONS[source]}</span>

        {source === 'donation' && (
          <div className="source-section-body">
            <div className="source-field">
              <label htmlFor="donation-bot">Bot</label>
              <input
                id="donation-bot"
                name="donation-bot"
                type="text"
                value={botName}
                placeholder="livepix"
                onChange={e => setBotName(e.target.value.trim() || 'livepix')}
              />
            </div>
            <div className="source-field">
              <label htmlFor="donation-min">Mínimo</label>
              <div className="input-with-prefix">
                <span>R$</span>
                <input
                  id="donation-min"
                  name="donation-min"
                  type="number"
                  value={minDonation}
                  min={0}
                  step={1}
                  onChange={e => setMinDonation(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        )}

        {source === 'chat' && (
          <div className="source-section-body">
            <div className="source-field">
              <label htmlFor="chat-command">Comando</label>
              <input
                id="chat-command"
                name="chat-command"
                type="text"
                value={chatCommand}
                placeholder={DEFAULTS.chatCommand}
                onChange={e => setChatCommand(e.target.value.trim() || DEFAULTS.chatCommand)}
              />
            </div>
            <div className="source-field">
              <label htmlFor="chat-tier">Tier mínimo</label>
              <select id="chat-tier" name="chat-tier" value={getMinTier()} onChange={e => setMinTier(Number(e.target.value))}>
                <option value={1}>Tier 1</option>
                <option value={2}>Tier 2</option>
                <option value={3}>Tier 3</option>
              </select>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className={`sources-panel ${isOpen ? 'open' : ''}`} id="sourcesPanel">
      <div className="sources-panel-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="sources-panel-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Fontes de Pedidos
        </span>
        <span className="sources-panel-toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>

      <div className="sources-panel-body">
        <div className="source-sections">
          {(['donation', 'resub', 'chat'] as SourceType[]).map(renderSourceSection)}
        </div>

        <div className={`priority-section${sortMode === 'fifo' ? ' disabled' : ''}`}>
          <div className="priority-header">Ordenação dos pedidos</div>
          <p className="priority-desc">
            Ordenação atual: {sortMode === 'fifo'
              ? 'novos pedidos entram no final da fila (ordem de chegada)'
              : 'novos pedidos entram ordenados de acordo com a prioridade'}.
          </p>
          <p className="priority-desc">
            Prioridade
          </p>
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
