import { memo, useState } from 'react';
import type { Request } from '../types';
import { useContextMenu } from '../context/ContextMenuContext';
import { getKillerPortrait } from '../data/characters';
import { CharacterAvatar } from './CharacterAvatar';

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

function formatRelativeTime(date: Date): string {
  const diff = (date.getTime() - Date.now()) / 1000;
  if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), 'second');
  if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

interface Props {
  request: Request;
  onToggleDone: (id: number) => void;
  showDone?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (id: number) => void;
  onDragOver?: (id: number) => void;
  onDragEnd?: () => void;
}

export const CharacterRequestCard = memo(function CharacterRequestCard({
  request, onToggleDone, showDone = false,
  isDragging, isDragOver, onDragStart, onDragOver, onDragEnd
}: Props) {
  const { show: showContextMenu } = useContextMenu();
  const [exiting, setExiting] = useState(false);
  const r = request;
  const showChar = r.type === 'survivor' || r.type === 'killer' || r.character === 'Identificando...';
  const portrait = r.type === 'killer' && r.character ? getKillerPortrait(r.character) : null;
  const charDisplay = r.character || r.type;
  const isCollapsed = r.done;

  const handleClick = () => {
    if (!r.done && !showDone) {
      setExiting(true);
      setTimeout(() => onToggleDone(r.id), 300);
    } else {
      onToggleDone(r.id);
    }
  };
  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(r.id, e.clientX, e.clientY, !!r.done);
  };

  const badgeText = r.source === 'donation' ? r.amount :
                    r.source === 'chat' ? `TIER ${r.subTier || 1}` :
                    r.source === 'resub' ? 'RESUB' : '';

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(r.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver?.(r.id);
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  const className = [
    'request-card',
    isCollapsed && 'collapsed',
    `source-${r.source || 'donation'}`,
    isDragging && 'dragging',
    isDragOver && 'drag-over',
    exiting && 'deleting'
  ].filter(Boolean).join(' ');

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.drag-handle')) {
      e.currentTarget.setAttribute('draggable', 'true');
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.currentTarget.setAttribute('draggable', 'false');
  };

  return (
    <div
      className={className}
      onContextMenu={handleContext}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="request-actions">
        <div className="drag-handle" title="Arrastar">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </div>
        <button
          className={`request-action-btn ${r.done ? 'undo' : 'done'}`}
          onClick={handleClick}
          title={r.done ? 'Marcar como não feito' : 'Marcar como feito'}
        >
          {r.done ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
        </button>
      </div>
      <div className="request-card-top">
        <div className="donor">
          {r.done && (
            <span className="done-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          )}
          <span className="donor-name">{r.donor}</span>
          <span className="msg-preview" title={r.message}>{r.message}</span>
          {badgeText && (
            <span className={`amount source-${r.source}`}>
              {badgeText}
            </span>
          )}
        </div>
        <span className="time">{formatRelativeTime(r.timestamp)}</span>
      </div>
      {showChar && (
        <div className="character">
          <CharacterAvatar portrait={portrait ?? undefined} type={r.type} />
          <span className={`char-name${r.character === 'Identificando...' ? ' identifying' : ''}${!r.character && r.type !== 'unknown' ? ' type-only' : ''}`}>
            {charDisplay}
          </span>
        </div>
      )}
    </div>
  );
});
