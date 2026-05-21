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
    <ul className="whats-new-list">
      {entries.map(e => (
        <li key={e.id} className="whats-new-item">
          <div className="whats-new-item-title">{t(e.titleKey)}</div>
          <div className="whats-new-item-desc">{t(e.descriptionKey)}</div>
        </li>
      ))}
    </ul>
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
        position: 'top-right',
        classNames: { toast: 'whats-new-toast' },
        onDismiss: () => dismissAll(ids),
        onAutoClose: () => dismissAll(ids),
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [enabled]);
}
