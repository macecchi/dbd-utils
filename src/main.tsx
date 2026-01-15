import { createRoot } from 'react-dom/client';
import { App } from './App';
import { migrate } from './store/migrate';

migrate();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
