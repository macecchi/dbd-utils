import { useEffect, useCallback } from 'react';
import { identifyCharacter } from '../services';
import { DonationCard } from './DonationCard';
import { ContextMenu } from './ContextMenu';
import { ContextMenuProvider } from '../context/ContextMenuContext';
import { useRequests, useSources, useSettings, useToasts } from '../store';

type SourceType = 'donation' | 'resub' | 'chat' | 'manual';

function getSortedRequests(requests: ReturnType<typeof useRequests.getState>['requests'], priority: SourceType[]) {
  return [...requests].sort((a, b) => {
    const aPrio = priority.indexOf(a.source || 'donation');
    const bPrio = priority.indexOf(b.source || 'donation');
    if (aPrio !== bPrio) return aPrio - bPrio;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
}

interface Props {
  onClearDoneRef?: React.MutableRefObject<(() => void) | null>;
}

export function DonationList({ onClearDoneRef }: Props) {
  const { requests, toggleDone, remove, clearDone, undo, update } = useRequests();
  const priority = useSources((s) => s.priority);
  const { apiKey, models } = useSettings();
  const { showUndo } = useToasts();

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
      }
    };
    document.addEventListener('keydown', handleUndoKey);
    return () => document.removeEventListener('keydown', handleUndoKey);
  }, [undo]);

  if (requests.length === 0) {
    return <div className="empty">Aguardando doações...</div>;
  }

  const sorted = getSortedRequests(requests, priority);

  return (
    <ContextMenuProvider>
      {sorted.map(d => (
        <DonationCard
          key={d.id}
          donation={d}
          onToggleDone={toggleDone}
          onDelete={handleDelete}
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
