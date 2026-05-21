import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { I18nProvider, t } from './i18n';
import { toast } from 'sonner';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Don't activate the new SW eagerly — calling updateSW(true) here races
    // with the reload it triggers, so the waiting SW often doesn't actually
    // take control, and the next page load sees it still waiting → this
    // callback fires again, and the toast pops on every reload. Defer
    // activation to the user's click: skipWaiting + reload happens in one
    // controlled step, and the new page load has no waiting SW.
    toast(t('toast.newVersionAvailable'), {
      id: 'new-version',
      duration: Infinity,
      action: { label: t('toast.updateAction'), onClick: () => updateSW(true) },
    });
  }
});

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<I18nProvider><App /></I18nProvider>);
}
