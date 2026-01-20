import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';

// Set CSS custom properties for image paths that need base URL
const base = import.meta.env.BASE_URL;
document.documentElement.style.setProperty('--portrait-bg', `url('${base}images/CharPortrait_bg.webp')`);
document.documentElement.style.setProperty('--portrait-role-bg', `url('${base}images/CharPortrait_roleBG.webp')`);

registerSW({
  immediate: true,
  onNeedRefresh() {
    location.reload();
  }
});

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
