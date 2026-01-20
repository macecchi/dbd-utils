import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  requestId: number | null;
  isDone: boolean;
}

interface ContextMenuContextValue {
  state: ContextMenuState;
  show: (id: number, x: number, y: number, isDone: boolean) => void;
  hide: () => void;
}

const initialState: ContextMenuState = {
  show: false,
  x: 0,
  y: 0,
  requestId: null,
  isDone: false
};

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContextMenuState>(initialState);

  const show = useCallback((id: number, x: number, y: number, isDone: boolean) => {
    setState({ show: true, x, y, requestId: id, isDone });
  }, []);

  const hide = useCallback(() => {
    setState(s => ({ ...s, show: false, requestId: null }));
  }, []);

  useEffect(() => {
    const handleClick = () => hide();
    const handleContext = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.request-card')) hide();
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('contextmenu', handleContext);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleContext);
    };
  }, [hide]);

  return (
    <ContextMenuContext.Provider value={{ state, show, hide }}>
      {children}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) throw new Error('useContextMenu must be used within ContextMenuProvider');
  return ctx;
}
