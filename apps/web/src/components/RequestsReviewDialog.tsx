import { useState, useMemo, useCallback, useRef } from 'react';
import type { Request } from '../types';
import { RequestsTable, type RequestsTableColumn } from './RequestsTable';

interface Props {
  isOpen: boolean;
  requests: Request[];
  onApply: (requests: Request[]) => void;
  onClose: () => void;
}

type Tab = 'current' | 'changes';

const DATETIME_FMT: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };

export function RequestsReviewDialog({ isOpen, requests, onApply, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('current');
  const [edits, setEdits] = useState<Map<number, Partial<Request>>>(new Map);
  const lastClickedIdx = useRef<number | null>(null);

  const handleClose = useCallback(() => {
    setEdits(new Map());
    setTab('current');
    lastClickedIdx.current = null;
    onClose();
  }, [onClose]);

  const editedRequests = useMemo(() =>
    requests.map(r => {
      const edit = edits.get(r.id);
      return edit ? { ...r, ...edit } : r;
    }),
    [requests, edits],
  );

  const changedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const [id, edit] of edits) {
      const orig = requests.find(r => r.id === id);
      if (!orig) continue;
      if (edit.done !== undefined && edit.done !== orig.done) ids.add(id);
    }
    return ids;
  }, [requests, edits]);

  const setDone = useCallback((id: number, done: boolean) => {
    setEdits(prev => {
      const next = new Map(prev);
      const orig = requests.find(r => r.id === id);
      if (!orig) return prev;
      if (done === !!orig.done) {
        next.delete(id);
      } else {
        const current = next.get(id);
        next.set(id, { ...current, done, doneAt: done ? new Date() : undefined });
      }
      return next;
    });
  }, [requests]);

  const toggleDone = useCallback((id: number) => {
    const orig = requests.find(r => r.id === id);
    if (!orig) return;
    const edit = edits.get(id);
    const currentDone = edit?.done !== undefined ? edit.done : orig.done;
    setDone(id, !currentDone);
  }, [requests, edits, setDone]);

  const handleRowClick = useCallback((idx: number, e: React.MouseEvent) => {
    const list = tab === 'changes'
      ? editedRequests.filter(r => changedIds.has(r.id))
      : editedRequests;
    const clickedReq = list[idx];
    if (!clickedReq) return;

    if (e.shiftKey && lastClickedIdx.current !== null && lastClickedIdx.current !== idx) {
      const from = Math.min(lastClickedIdx.current, idx);
      const to = Math.max(lastClickedIdx.current, idx);
      const orig = requests.find(r => r.id === clickedReq.id);
      if (!orig) return;
      const edit = edits.get(clickedReq.id);
      const currentDone = edit?.done !== undefined ? edit.done : orig.done;
      const targetDone = !currentDone;
      for (let i = from; i <= to; i++) {
        const r = list[i];
        if (r) setDone(r.id, targetDone);
      }
    } else {
      toggleDone(clickedReq.id);
    }
    lastClickedIdx.current = idx;
  }, [tab, editedRequests, changedIds, requests, edits, setDone, toggleDone]);

  const handleApply = useCallback(() => {
    if (changedIds.size === 0) return;
    onApply(editedRequests);
    setEdits(new Map());
    setTab('current');
  }, [editedRequests, changedIds, onApply]);

  const undoneCount = useMemo(() => editedRequests.filter(r => !r.done).length, [editedRequests]);

  const markAllDone = useCallback(() => {
    setEdits(prev => {
      const next = new Map(prev);
      for (const r of requests) {
        if (r.done) continue;
        const current = next.get(r.id);
        const currentDone = current?.done !== undefined ? current.done : false;
        if (!currentDone) {
          next.set(r.id, { ...current, done: true, doneAt: new Date() });
        }
      }
      return next;
    });
  }, [requests]);

  if (!isOpen) return null;

  const changesTab = tab === 'changes';
  const displayRequests = changesTab
    ? editedRequests.filter(r => changedIds.has(r.id))
    : editedRequests;

  const leadColumns: RequestsTableColumn[] = [
    {
      key: 'num',
      header: '#',
      className: 'req-col-num',
      render: (r) => editedRequests.indexOf(r),
    },
  ];

  const trailColumns: RequestsTableColumn[] = [
    {
      key: 'done',
      header: 'Feito',
      className: 'req-col-done',
      render: (r, i) => {
        const orig = requests.find(o => o.id === r.id)!;
        const doneNow = !!r.done;
        const doneBefore = !!orig.done;
        const changed = changedIds.has(r.id);

        if (changesTab) {
          return (
            <span className="review-done-diff">
              <span className={doneBefore ? 'review-diff-old done' : 'review-diff-old'}>{doneBefore ? 'Sim' : 'Não'}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              <span className={doneNow ? 'review-diff-new done' : 'review-diff-new'}>{doneNow ? 'Sim' : 'Não'}</span>
            </span>
          );
        }

        return (
          <button
            className={`review-done-btn${doneNow ? ' checked' : ''}${changed ? ' changed' : ''}`}
            onClick={e => handleRowClick(i, e)}
            title={doneNow ? 'Marcar como não feito' : 'Marcar como feito'}
          >
            {doneNow ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="3" />
              </svg>
            )}
          </button>
        );
      },
    },
    {
      key: 'dates',
      header: 'Recebido / Feito',
      className: 'req-col-dates',
      render: (r) => (
        <div className="review-dates-wrap">
          <span className="review-date-icon"></span>
          <span>{r.timestamp.toLocaleString('pt-BR', DATETIME_FMT)}</span>
          {r.doneAt && (<>
            <span className="review-date-icon review-done-time">✓</span>
            <span className="review-done-time">{r.doneAt.toLocaleString('pt-BR', DATETIME_FMT)}</span>
          </>)}
        </div>
      ),
    },
  ];

  return (
    <div className="modal-overlay open" onClick={handleClose}>
      <div className="review-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 3v18" />
            </svg>
            Revisar pedidos
          </div>
          <button className="modal-close" onClick={handleClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="dialog-help-text">Visualize e altere o status dos pedidos. Marque um pedido como feito ou adicione de volta à fila. Segure Shift para selecionar vários de uma vez. Revise as alterações na aba "Alterações" e aplique quando estiver pronto.</p>

        <div className="review-tabs">
          <button
            className={`review-tab${tab === 'current' ? ' active' : ''}`}
            onClick={() => setTab('current')}
          >
            Todos ({requests.length})
          </button>
          <button
            className={`review-tab${tab === 'changes' ? ' active' : ''}`}
            onClick={() => setTab('changes')}
          >
            Alterações {changedIds.size > 0 && <span className="review-tab-badge">{changedIds.size}</span>}
          </button>
        </div>

        <div className="req-table-wrap">
          <RequestsTable
            requests={displayRequests}
            leadColumns={leadColumns}
            trailColumns={trailColumns}
            showId
            showTimestamp={false}
            rowClassName={(r) => changedIds.has(r.id) ? 'review-row-changed' : undefined}
            emptyText={changesTab ? 'Nenhuma alteração ainda. Mude o status na aba "Todos".' : 'Nenhum pedido na fila.'}
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={handleClose}>Cancelar</button>
          <button
            className="btn btn-ghost"
            onClick={markAllDone}
            disabled={undoneCount === 0}
            title="Marcar todos como feitos"
          >
            Marcar todos como feitos{undoneCount > 0 ? ` (${undoneCount})` : ''}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={changedIds.size === 0}
          >
            Aplicar {changedIds.size > 0 ? `${changedIds.size} alteraç${changedIds.size === 1 ? 'ão' : 'ões'}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
