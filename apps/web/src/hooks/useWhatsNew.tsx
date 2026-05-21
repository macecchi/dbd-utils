import { useEffect } from 'react';
import { toast } from 'sonner';
import { changelog, type ChangelogEntry } from '../data/changelog';
import { t } from '../i18n';

const STORAGE_KEY = 'dbd-whats-new-dismissed';
const TOAST_ID = 'whats-new';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function dismissAll(ids: string[]) {
  const dismissed = getDismissed();
  for (const id of ids) dismissed.add(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
  } catch { /* ignore */ }
}

function DigestBody({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.map(e => (
        <div key={e.id}>
          <div style={{ fontWeight: 600 }}>• {t(e.titleKey)}</div>
          <div>{t(e.descriptionKey)}</div>
        </div>
      ))}
    </div>
  );
}

export function useWhatsNew(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const dismissed = getDismissed();
    const unseen = changelog.filter((entry) => !dismissed.has(entry.id));
    if (unseen.length === 0) return;

    // Small delay so it doesn't compete with initial connection toasts.

    const timer = setTimeout(() => {
      const ids = unseen.map(e => e.id);
      toast(t('whatsNew.title'), {
        id: TOAST_ID,
        description: <DigestBody entries={unseen} />,
        duration: Infinity,
        onDismiss: () => dismissAll(ids),
        onAutoClose: () => dismissAll(ids),
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [enabled]);
}
