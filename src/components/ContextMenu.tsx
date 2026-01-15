import { useContextMenu } from '../context/ContextMenuContext';

interface Props {
  onToggleDone: (id: number) => void;
  onRerun: (id: number) => void;
}

export function ContextMenu({ onToggleDone, onRerun }: Props) {
  const { state, hide } = useContextMenu();

  const handleAction = (action: 'done' | 'rerun') => {
    if (!state.requestId) return;
    switch (action) {
      case 'done': onToggleDone(state.requestId); break;
      case 'rerun': onRerun(state.requestId); break;
    }
    hide();
  };

  if (!state.show) return null;

  return (
    <div
      className="context-menu show"
      style={{ left: state.x, top: state.y }}
    >
      <div className="context-menu-item" onClick={() => handleAction('done')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>{state.isDone ? 'Marcar como não feito' : 'Marcar como feito'}</span>
      </div>
      <div className="context-menu-item" onClick={() => handleAction('rerun')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        Re-identificar
      </div>
    </div>
  );
}
