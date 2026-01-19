import { useCallback, useState } from 'react';
import { identifyCharacter } from '../services';
import { CharacterRequestCard } from './CharacterRequestCard';
import { ContextMenu } from './ContextMenu';
import { ContextMenuProvider } from '../context/ContextMenuContext';
import { useChannel, useSettings, useToasts } from '../store';

interface Props {
  showDone?: boolean;
}

export function CharacterRequestList({ showDone = false }: Props) {
  const { useRequests } = useChannel();
  const { requests, toggleDone, update, reorder } = useRequests();
  const { apiKey, models } = useSettings();
  const { showUndo } = useToasts();
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const llmConfig = { apiKey, models };
  const filtered = showDone ? requests : requests.filter(r => !r.done);

  const handleToggleDone = useCallback((id: number) => {
    const request = requests.find(r => r.id === id);
    if (request && !request.done && !showDone) {
      showUndo('Marcado como feito', () => toggleDone(id));
    }
    toggleDone(id);
  }, [requests, toggleDone, showDone, showUndo]);

  const rerunExtraction = useCallback(async (id: number) => {
    const request = requests.find(r => r.id === id);
    if (request) {
      update(id, { character: 'Identificando...', type: 'unknown' });
      const result = await identifyCharacter(request, llmConfig);
      update(id, result);
    }
  }, [requests, update, llmConfig]);

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

  if (filtered.length === 0) {
    return <div className="empty">{showDone ? 'Nenhum pedido' : 'Aguardando pedidos...'}</div>;
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
            />
          );
        });
      })()}
      <ContextMenu
        onToggleDone={handleToggleDone}
        onRerun={rerunExtraction}
      />
    </ContextMenuProvider>
  );
}
