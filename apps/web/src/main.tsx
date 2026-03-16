import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { I18nProvider, t } from './i18n';
import { toast } from 'sonner';

// Set CSS custom properties for image paths that need base URL
const base = import.meta.env.BASE_URL;
document.documentElement.style.setProperty('--portrait-bg', `url('${base}images/CharPortrait_bg.webp')`);
document.documentElement.style.setProperty('--portrait-role-bg', `url('${base}images/CharPortrait_roleBG.webp')`);

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Activate new SW so assets are cached, then prompt user to reload
    updateSW(true);
    toast(t('toast.newVersionAvailable'), {
      description: t('toast.clickToUpdate'),
      duration: Infinity,
      action: { label: t('toast.clickToUpdate'), onClick: () => location.reload() },
    });
  }
});

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<I18nProvider><App /></I18nProvider>);
}
