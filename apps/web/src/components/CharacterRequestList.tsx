import { useCallback, useState } from 'react';
import { identifyCharacter } from '../services';
import { CharacterRequestCard } from './CharacterRequestCard';
import { ContextMenu } from './ContextMenu';
import { ContextMenuProvider } from '../context/ContextMenuContext';
import { useChannel, useToasts } from '../store';

interface Props {
  showDone?: boolean;
}

export function CharacterRequestList({ showDone = false }: Props) {
  const { useRequests, useSources, isOwnChannel } = useChannel();
  const { requests, toggleDone, update, reorder } = useRequests();
  const serverIrcConnected = useSources((s) => s.serverIrcConnected);
  const { showUndo } = useToasts();
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const readOnly = !isOwnChannel;
  const filtered = showDone ? requests : requests.filter(r => !r.done);

  const handleToggleDone = useCallback((id: number) => {
    if (readOnly) return;
    const request = requests.find(r => r.id === id);
    if (request && !request.done && !showDone) {
      showUndo('Marcado como feito', () => toggleDone(id));
    }
    toggleDone(id);
  }, [requests, toggleDone, showDone, showUndo, readOnly]);

  const rerunExtraction = useCallback(async (id: number) => {
    const request = requests.find(r => r.id === id);
    if (request) {
      update(id, { character: 'Identificando...', type: 'unknown' });
      const result = await identifyCharacter(request);
      update(id, result);
    }
  }, [requests, update]);

  const handleDragStart = useCallback((id: number) => {
    if (readOnly) return;
    setDraggedId(id);
  }, [readOnly]);

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

  if (filtered.length === 0) {
    const emptyMessage = showDone
      ? 'Nenhum pedido'
      : !isOwnChannel && !serverIrcConnected
        ? 'Streamer offline'
        : 'Aguardando pedidos...';
    return <div className="empty">{emptyMessage}</div>;
  }

  return (
    <ContextMenuProvider>
      {(() => {
        let activeIndex = 0;
        return filtered.map((r) => {
          const position = r.done ? undefined : ++activeIndex;
          return (
            <CharacterRequestCard
              key={r.id}
              request={r}
              position={position}
              onToggleDone={handleToggleDone}
              showDone={showDone}
              isDragging={draggedId === r.id}
              isDragOver={dragOverId === r.id}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              readOnly={readOnly}
            />
          );
        });
      })()}
      {!readOnly && (
        <ContextMenu
          onToggleDone={handleToggleDone}
          onRerun={rerunExtraction}
        />
      )}
    </ContextMenuProvider>
  );
}
