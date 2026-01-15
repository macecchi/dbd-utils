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
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (id: number) => void;
  onDragOver?: (id: number) => void;
  onDragEnd?: () => void;
}

export const DonationCard = memo(function DonationCard({
  donation, onToggleDone, onDelete,
  isDragging, isDragOver, onDragStart, onDragOver, onDragEnd
}: Props) {
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

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(d.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver?.(d.id);
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  const className = [
    'donation',
    d.belowThreshold && 'below-threshold',
    isCollapsed && 'collapsed',
    `source-${d.source || 'donation'}`,
    isDragging && 'dragging',
    isDragOver && 'drag-over'
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      onContextMenu={handleContext}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="row-hover-actions">
        <button className={`hover-btn ${d.done ? 'undo' : 'done'}`} onClick={handleClick}>
          {d.done ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Desfazer
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Concluído
            </>
          )}
        </button>
        <button className="hover-btn delete" onClick={handleDelete}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          Excluir
        </button>
      </div>
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
        <span className="time">{formatRelativeTime(d.timestamp)}</span>
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
