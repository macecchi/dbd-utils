import { useEffect, useRef, useState, type ReactNode } from 'react';

interface EditableFieldProps {
  label: string;
  /** Static representation of the value when not editing (e.g. "R$ 5", "!fila", "Tier 1"). */
  displayValue: ReactNode;
  /** The actual editor (input/select) to reveal when the pencil is clicked. */
  children: ReactNode;
  disabled?: boolean;
}

const PencilIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export function EditableField({ label, displayValue, children, disabled }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const focusable = wrapperRef.current?.querySelector<HTMLElement>('input, select, textarea');
    focusable?.focus();
    if (focusable instanceof HTMLInputElement && focusable.type === 'text') focusable.select();
  }, [editing]);

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (wrapperRef.current && !wrapperRef.current.contains(e.relatedTarget as Node | null)) {
      setEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      // Commit (existing onBlur on children handles persistence) and exit edit mode.
      (e.target as HTMLElement).blur();
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  return (
    <div className="settings-field" ref={wrapperRef} onBlur={handleBlur} onKeyDown={handleKeyDown}>
      <span className="settings-field-label">{label}</span>
      {editing ? (
        <div className="settings-field-editor">{children}</div>
      ) : (
        <div className="settings-field-display">
          <span className="settings-field-value">{displayValue}</span>
          <button
            type="button"
            className="settings-field-edit-btn"
            onClick={() => setEditing(true)}
            disabled={disabled}
            aria-label={`Edit ${label}`}
          >
            <PencilIcon />
          </button>
        </div>
      )}
    </div>
  );
}
