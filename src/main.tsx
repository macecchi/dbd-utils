import { createRoot } from 'react-dom/client';
import { App } from './App';
import { chatStore } from './store/chat';
import { connectionStore } from './store/connection';
import { requestStore } from './store/requests';
import { settingsStore } from './store/settings';
import { sourcesStore } from './store/sources';
import { connect } from './services';

// Initialize stores
chatStore.init();
requestStore.init();
connectionStore.init();
settingsStore.init();
sourcesStore.init();

// Render app
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}

// Auto-connect on load
setTimeout(() => connect(), 500);
