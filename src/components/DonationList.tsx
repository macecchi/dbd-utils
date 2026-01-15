import { useEffect, useCallback, useState } from 'react';
import { identifyCharacter } from '../services';
import { DonationCard } from './DonationCard';
import { ContextMenu } from './ContextMenu';
import { ContextMenuProvider } from '../context/ContextMenuContext';
import { useRequests, useSettings, useToasts } from '../store';

interface Props {
  onClearDoneRef?: React.MutableRefObject<(() => void) | null>;
}

export function DonationList({ onClearDoneRef }: Props) {
  const { requests, toggleDone, remove, clearDone, undo, update, reorder } = useRequests();
  const { apiKey, models } = useSettings();
  const { showUndo, clearUndo } = useToasts();
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const llmConfig = { apiKey, models };

  const handleDelete = useCallback((id: number) => {
    remove([id]);
    showUndo(1, () => undo());
  }, [remove, showUndo, undo]);

  const rerunExtraction = useCallback(async (id: number) => {
    const request = requests.find(d => d.id === id);
    if (request) {
      update(id, { character: 'Identificando...', type: 'unknown' });
      const result = await identifyCharacter(request, llmConfig);
      update(id, result);
    }
  }, [requests, update, llmConfig]);

  const handleClearDone = useCallback(() => {
    const count = clearDone();
    if (count > 0) {
      showUndo(count, () => undo());
    }
  }, [clearDone, showUndo, undo]);

  useEffect(() => {
    if (onClearDoneRef) onClearDoneRef.current = handleClearDone;
    return () => { if (onClearDoneRef) onClearDoneRef.current = null; };
  }, [handleClearDone, onClearDoneRef]);

  useEffect(() => {
    const handleUndoKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undo();
        clearUndo();
      }
    };
    document.addEventListener('keydown', handleUndoKey);
    return () => document.removeEventListener('keydown', handleUndoKey);
  }, [undo, clearUndo]);

  const handleDragStart = useCallback((id: number) => {
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback((id: number) => {
    if (draggedId && draggedId !== id) {
      setDragOverId(id);
    }
  }, [draggedId]);

  const handleDragEnd = useCallback(() => {
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      reorder(draggedId, dragOverId);
    }
    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, dragOverId, reorder]);

  if (requests.length === 0) {
    return <div className="empty">Aguardando doações...</div>;
  }

  return (
    <ContextMenuProvider>
      {requests.map(d => (
        <DonationCard
          key={d.id}
          donation={d}
          onToggleDone={toggleDone}
          onDelete={handleDelete}
          isDragging={draggedId === d.id}
          isDragOver={dragOverId === d.id}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        />
      ))}
      <ContextMenu
        onToggleDone={toggleDone}
        onRerun={rerunExtraction}
        onDelete={handleDelete}
      />
    </ContextMenuProvider>
  );
}
