import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { migrate } from './store/migrate';

migrate();
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
