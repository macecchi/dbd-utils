import { createRoot } from 'react-dom/client';
import { ChatLog } from './components/ChatLog';
import { Stats } from './components/Stats';
import { ToastContainer } from './components/ToastContainer';
import { chatStore } from './store/chat';
import { donationStore } from './store/donations';
import './store/toasts';

chatStore.init();
donationStore.init();

const chatlogEl = document.getElementById('chatlog');
if (chatlogEl) {
  createRoot(chatlogEl).render(<ChatLog />);
}

const statsEl = document.querySelector('.stats');
if (statsEl) {
  createRoot(statsEl).render(<Stats />);
}

const toastEl = document.getElementById('toastContainer');
if (toastEl) {
  createRoot(toastEl).render(<ToastContainer />);
}
