import { useState, useEffect } from 'react';
import { useToasts } from '../store';
import type { Toast } from '../types';

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: number) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (toast.duration > 0) {
      const fadeTimer = setTimeout(() => setFading(true), toast.duration - 200);
      return () => clearTimeout(fadeTimer);
    }
  }, [toast.duration]);

  const handleUndo = () => {
    toast.undoCallback?.();
    onRemove(toast.id);
  };

  const className = [
    'toast',
    fading && 'fade-out'
  ].filter(Boolean).join(' ');

  const style = toast.color ? { borderColor: `var(--${toast.color})` } : undefined;

  return (
    <div className={className} style={style}>
      {toast.title && <span className="toast-title" style={toast.color ? { color: `var(--${toast.color})` } : undefined}>{toast.title}</span>}
      <span>{toast.message}</span>
      {toast.type === 'undo' && (
        <button className="undo-btn" onClick={handleUndo}>Desfazer</button>
      )}
    </div>
  );
}

export function ToastContainer() {
  const { toasts, remove } = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={remove} />
      ))}
    </div>
  );
}
