import { useEffect } from 'react';
import { toast } from 'sonner';
import { changelog } from '../data/changelog';
import { t } from '../i18n';

const STORAGE_KEY = 'dbd-whats-new-dismissed';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function dismiss(id: string) {
  const dismissed = getDismissed();
  dismissed.add(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
  } catch { /* ignore */ }
}

export function useWhatsNew(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const dismissed = getDismissed();
    const unseen = changelog.filter((entry) => !dismissed.has(entry.id));
    if (unseen.length === 0) return;

    // Small delay so it doesn't compete with initial connection toasts
    const timer = setTimeout(() => {
      for (const entry of unseen) {
        toast(t(entry.titleKey), {
          id: entry.id,
          description: t(entry.descriptionKey),
          duration: Infinity,
          onDismiss: () => dismiss(entry.id),
          onAutoClose: () => dismiss(entry.id),
        });
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [enabled]);
}
