/** Migrating localStorage data to new formats */

const OLD_KEYS = [
  'gemini_key', 'gemini_models', 'dbd_bot_name', 'dbd_min_donation',
  'dbd_channel', 'dbd_chat_hidden', 'dbd_chat', 'dbd_donations'
];

export function migrate() {
  if (!OLD_KEYS.some(k => localStorage.getItem(k))) return;

  // Settings
  const apiKey = localStorage.getItem('gemini_key') || '';
  const models = JSON.parse(localStorage.getItem('gemini_models') || 'null');
  const botName = localStorage.getItem('dbd_bot_name') || 'livepix';
  const minDonation = parseFloat(localStorage.getItem('dbd_min_donation') || '10');
  const channel = localStorage.getItem('dbd_channel') || '';
  localStorage.setItem('dbd-settings', JSON.stringify({
    state: { apiKey, models: models || ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'], botName, minDonation, channel, chatHidden: true },
    version: 0
  }));

  // Requests
  const oldDonations = localStorage.getItem('dbd_donations');
  if (oldDonations) {
    try {
      const requests = JSON.parse(oldDonations).map((d: any) => ({
        ...d,
        source: d.source || 'donation'
      }));
      localStorage.setItem('dbd-requests', JSON.stringify({
        state: { requests },
        version: 0
      }));
    } catch { }
  }

  // Cleanup
  OLD_KEYS.forEach(k => localStorage.removeItem(k));
}
