import { memo } from 'react';
import type { Request } from '../types';
import { useContextMenu } from '../context/ContextMenuContext';
import { getKillerPortrait } from '../data/characters';

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

function formatRelativeTime(date: Date): string {
  const diff = (date.getTime() - Date.now()) / 1000;
  if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), 'second');
  if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

interface Props {
  donation: Request;
  onToggleDone: (id: number) => void;
  onDelete: (id: number) => void;
}

export const DonationCard = memo(function DonationCard({ donation, onToggleDone, onDelete }: Props) {
  const { show: showContextMenu } = useContextMenu();
  const d = donation;
  const showChar = d.type === 'survivor' || d.type === 'killer' || d.character === 'Identificando...';
  const portrait = d.type === 'killer' && d.character ? getKillerPortrait(d.character) : null;
  const charDisplay = d.character || d.type;
  const isCollapsed = d.done || d.belowThreshold;

  const handleClick = () => onToggleDone(d.id);
  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(d.id, e.clientX, e.clientY, !!d.done);
  };
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(d.id);
  };

  const badgeText = d.source === 'donation' ? d.amount :
                    d.source === 'chat' ? `TIER ${d.subTier || 1}` :
                    d.source === 'resub' ? 'RESUB' : '';

  const className = [
    'donation',
    d.belowThreshold && 'below-threshold',
    isCollapsed && 'collapsed',
    `source-${d.source || 'donation'}`
  ].filter(Boolean).join(' ');

  return (
    <div className={className} onClick={handleClick} onContextMenu={handleContext}>
      <div className="donation-top">
        <div className="donor">
          {d.done && (
            <span className="done-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          )}
          <span className="donor-name">{d.donor}</span>
          {isCollapsed && showChar && <span className="char-name-inline">{charDisplay}</span>}
          {isCollapsed && (
            <span className="msg-preview">
              {d.message.slice(0, 40)}{d.message.length > 40 ? '…' : ''}
            </span>
          )}
          {badgeText && (
            <span className={`amount source-${d.source}${d.belowThreshold ? ' below' : ''}`}>
              {badgeText}
            </span>
          )}
        </div>
        <div className="time-actions">
          <div className="row-actions">
            <button className="row-btn danger" onClick={handleDelete} title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <span className="time">{formatRelativeTime(d.timestamp)}</span>
        </div>
      </div>
      <p className="message">{d.message}</p>
      {showChar && (
        <div className="character">
          {portrait && (
            <div className="char-portrait-wrapper">
              <div className="char-portrait-bg killer"></div>
              <img src={portrait} alt="" className="char-portrait" />
            </div>
          )}
          <span className={`char-name${d.character === 'Identificando...' ? ' identifying' : ''}${!d.character && d.type !== 'unknown' ? ' type-only' : ''}`}>
            {charDisplay}
          </span>
        </div>
      )}
    </div>
  );
});
