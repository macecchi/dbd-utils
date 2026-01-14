import { useEffect, useRef, useCallback } from 'react';
import { useRequests } from '../hooks/useRequests';
import { requestStore } from '../store/requests';
import { showUndoToast } from '../store/toasts';
import { identifyCharacter } from '../services';
import { DonationCard } from './DonationCard';
import { ContextMenu } from './ContextMenu';
import { ContextMenuProvider } from '../context/ContextMenuContext';
import type { Request } from '../types';

export interface DonationListHandle {
  clearDoneRequests: () => void;
}

const DEFAULT_SOURCE_PRIORITY = ['donation', 'resub', 'chat', 'manual'];

function getSourcePriority(): string[] {
  const saved = localStorage.getItem('dbd_source_priority');
  return saved ? JSON.parse(saved) : DEFAULT_SOURCE_PRIORITY;
}

function getSortedRequests(requests: Request[]): Request[] {
  const priority = getSourcePriority();
  return [...requests].sort((a, b) => {
    const aPrio = priority.indexOf(a.source || 'donation');
    const bPrio = priority.indexOf(b.source || 'donation');
    if (aPrio !== bPrio) return aPrio - bPrio;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
}

interface DonationListProps {
  onClearDoneRef?: React.MutableRefObject<(() => void) | null>;
}

export function DonationList({ onClearDoneRef }: DonationListProps) {
  const requests = useRequests();
  const lastDeletedRef = useRef<Request | Request[] | null>(null);

  const toggleDone = useCallback((id: number) => {
    const request = requestStore.get().find(d => d.id === id);
    if (request) {
      requestStore.update(id, { done: !request.done });
    }
  }, []);

  const deleteRequest = useCallback((id: number) => {
    const request = requestStore.get().find(d => d.id === id);
    if (request) {
      lastDeletedRef.current = request;
      requestStore.remove(id);
      showUndoToast(1, () => {
        if (lastDeletedRef.current && !Array.isArray(lastDeletedRef.current)) {
          requestStore.add(lastDeletedRef.current);
          lastDeletedRef.current = null;
        }
      });
    }
  }, []);

  const rerunExtraction = useCallback(async (id: number) => {
    const request = requestStore.get().find(d => d.id === id);
    if (request) {
      requestStore.update(id, { character: 'Identificando...', type: 'unknown' });
      await identifyCharacter(request);
    }
  }, []);

  const clearDoneRequests = useCallback(() => {
    const all = requestStore.get();
    const done = all.filter(d => d.done);
    if (done.length === 0) return;
    lastDeletedRef.current = done;
    requestStore.set(all.filter(d => !d.done));
    showUndoToast(done.length, () => {
      if (Array.isArray(lastDeletedRef.current)) {
        requestStore.set([...requestStore.get(), ...lastDeletedRef.current]);
        lastDeletedRef.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (onClearDoneRef) onClearDoneRef.current = clearDoneRequests;
    return () => { if (onClearDoneRef) onClearDoneRef.current = null; };
  }, [clearDoneRequests, onClearDoneRef]);

  useEffect(() => {
    const handleUndo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && lastDeletedRef.current) {
        e.preventDefault();
        if (Array.isArray(lastDeletedRef.current)) {
          requestStore.set([...requestStore.get(), ...lastDeletedRef.current]);
        } else {
          requestStore.add(lastDeletedRef.current);
        }
        lastDeletedRef.current = null;
      }
    };
    document.addEventListener('keydown', handleUndo);
    return () => document.removeEventListener('keydown', handleUndo);
  }, []);

  if (requests.length === 0) {
    return <div className="empty">Aguardando doações...</div>;
  }

  const sorted = getSortedRequests(requests);

  return (
    <ContextMenuProvider>
      {sorted.map(d => (
        <DonationCard
          key={d.id}
          donation={d}
          onToggleDone={toggleDone}
          onDelete={deleteRequest}
        />
      ))}
      <ContextMenu
        onToggleDone={toggleDone}
        onRerun={rerunExtraction}
        onDelete={deleteRequest}
      />
    </ContextMenuProvider>
  );
}
