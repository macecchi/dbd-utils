export interface StoreOptions<T> {
  key: string;
  defaultValue: T;
  load?: (saved: string) => T;
  save?: (value: T) => string;
}

export interface Store<T> {
  get: () => T;
  set: (value: T) => void;
  subscribe: (fn: () => void) => () => void;
  init: () => void;
}

export function createStore<T>(options: StoreOptions<T>): Store<T> {
  const { key, defaultValue, load, save } = options;
  let value: T = defaultValue;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach(fn => fn());

  const loadFromStorage = (): T => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return defaultValue;
      return load ? load(saved) : JSON.parse(saved);
    } catch {
      return defaultValue;
    }
  };

  const saveToStorage = () => {
    const serialized = save ? save(value) : JSON.stringify(value);
    localStorage.setItem(key, serialized);
  };

  return {
    get: () => value,

    set: (newValue: T) => {
      value = newValue;
      saveToStorage();
      notify();
    },

    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    init: () => {
      value = loadFromStorage();
    }
  };
}

export interface MemoryStoreOptions<T> {
  defaultValue: T;
}

export function createMemoryStore<T>(options: MemoryStoreOptions<T>): Omit<Store<T>, 'init'> {
  let value: T = options.defaultValue;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach(fn => fn());

  return {
    get: () => value,

    set: (newValue: T) => {
      value = newValue;
      notify();
    },

    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}
