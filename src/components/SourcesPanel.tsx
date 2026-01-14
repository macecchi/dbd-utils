import { useState, useRef, useEffect, useCallback } from 'react';
import { useSources } from '../hooks/useSources';
import { sourcesStore, SourceType } from '../store/sources';
import { requestStore } from '../store/requests';
import { showToastInfo } from '../store/toasts';
import { CHARACTERS } from '../data/characters';

const SOURCE_LABELS: Record<SourceType, string> = {
  donation: 'Doações',
  resub: 'Resubs',
  chat: 'Chat',
  manual: 'Manual'
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
  ),
  manual: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
};

interface CharacterOption {
  name: string;
  type: 'killer' | 'survivor';
}

function getAllCharacterNames(): CharacterOption[] {
  const names: CharacterOption[] = [];
  for (const type of ['killers', 'survivors'] as const) {
    for (const char of CHARACTERS[type]) {
      names.push({ name: char.name, type: type === 'killers' ? 'killer' : 'survivor' });
    }
  }
  return names;
}

export function SourcesPanel() {
  const sources = useSources();
  const [isOpen, setIsOpen] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [autocompleteItems, setAutocompleteItems] = useState<CharacterOption[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(-1);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [draggedItem, setDraggedItem] = useState<SourceType | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allChars = useRef<CharacterOption[]>([]);
  useEffect(() => {
    allChars.current = getAllCharacterNames();
  }, []);

  const handleManualInputChange = (value: string) => {
    setManualInput(value);
    const val = value.toLowerCase().trim();
    if (!val) {
      setShowAutocomplete(false);
      setAutocompleteItems([]);
      return;
    }
    const matches = allChars.current.filter(c => c.name.toLowerCase().includes(val)).slice(0, 8);
    setAutocompleteItems(matches);
    setShowAutocomplete(matches.length > 0);
    setAutocompleteIndex(-1);
  };

  const selectCharacter = useCallback((char: CharacterOption) => {
    if (!sources.enabled.manual) return;
    const request = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      donor: 'Manual',
      amount: '',
      amountVal: 0,
      message: char.name,
      character: char.name,
      type: char.type as 'survivor' | 'killer',
      belowThreshold: false,
      source: 'manual' as const
    };
    requestStore.add(request);
    setManualInput('');
    setShowAutocomplete(false);
  }, [sources.enabled.manual]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showAutocomplete || autocompleteItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAutocompleteIndex(i => Math.min(i + 1, autocompleteItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAutocompleteIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && autocompleteIndex >= 0) {
      e.preventDefault();
      selectCharacter(autocompleteItems[autocompleteIndex]);
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  };

  const handleDragStart = (source: SourceType) => {
    setDraggedItem(source);
  };

  const handleDragOver = (e: React.DragEvent, targetSource: SourceType) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetSource) return;
    const newPriority = [...sources.priority];
    const draggedIdx = newPriority.indexOf(draggedItem);
    const targetIdx = newPriority.indexOf(targetSource);
    newPriority.splice(draggedIdx, 1);
    newPriority.splice(targetIdx, 0, draggedItem);
    sourcesStore.setPriority(newPriority);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleResetSession = () => {
    sourcesStore.resetSession();
    showToastInfo('Sessao reiniciada');
  };

  return (
    <section className={`settings ${isOpen ? 'open' : ''}`} id="sourcesPanel">
      <div className="settings-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="settings-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v18M3 12h18" />
          </svg>
          Fontes de Pedidos
        </span>
        <span className="settings-toggle">▼</span>
      </div>
      <div className="settings-body">
        <div className="sources-grid">
          {(['donation', 'resub', 'chat', 'manual'] as SourceType[]).map(source => (
            <label key={source} className="source-toggle">
              <input
                type="checkbox"
                checked={sources.enabled[source]}
                onChange={e => sourcesStore.setEnabled(source, e.target.checked)}
              />
              <span className={`source-icon ${source}`}>
                {source === 'donation' ? '$' : source === 'resub' ? '↻' : source === 'chat' ? '💬' : '✎'}
              </span>
              {SOURCE_LABELS[source]}
            </label>
          ))}
        </div>

        <div className="sources-section">
          <div className="sources-label">Comando do chat</div>
          <input
            type="text"
            value={sources.chatCommand}
            placeholder="!request"
            onChange={e => sourcesStore.setChatCommand(e.target.value.trim())}
          />
        </div>

        <div className="sources-section">
          <div className="sources-label">Tiers permitidos</div>
          <div className="tier-checkboxes">
            {[1, 2, 3].map(tier => (
              <label key={tier}>
                <input
                  type="checkbox"
                  checked={sources.chatTiers.includes(tier)}
                  onChange={e => {
                    const newTiers = e.target.checked
                      ? [...sources.chatTiers, tier]
                      : sources.chatTiers.filter(t => t !== tier);
                    sourcesStore.setChatTiers(newTiers);
                  }}
                />
                Tier {tier}
              </label>
            ))}
          </div>
        </div>

        <div className="sources-section">
          <div className="sources-label">Prioridade (arrastar)</div>
          <div className="priority-list">
            {sources.priority.map(source => (
              <div
                key={source}
                className={`priority-item ${draggedItem === source ? 'dragging' : ''}`}
                draggable
                data-source={source}
                onDragStart={() => handleDragStart(source)}
                onDragOver={e => handleDragOver(e, source)}
                onDragEnd={handleDragEnd}
              >
                <span className="drag-handle">⠿</span>
                <span className="priority-icon">{SOURCE_ICONS[source]}</span>
                <span>{SOURCE_LABELS[source]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sources-section">
          <div className="sources-label">Adicionar manual</div>
          <div className="manual-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={manualInput}
              placeholder="Digite o nome do personagem..."
              autoComplete="off"
              onChange={e => handleManualInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
            />
            <div ref={dropdownRef} className={`autocomplete-dropdown ${showAutocomplete ? 'show' : ''}`}>
              {autocompleteItems.map((item, i) => (
                <div
                  key={item.name}
                  className={`autocomplete-item ${item.type} ${i === autocompleteIndex ? 'active' : ''}`}
                  onMouseDown={() => selectCharacter(item)}
                >
                  {item.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sources-section">
          <button className="btn btn-ghost" onClick={handleResetSession}>
            Nova Stream (resetar sessao)
          </button>
        </div>
      </div>
    </section>
  );
}
