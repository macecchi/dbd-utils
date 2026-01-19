// apps/web/src/utils/migrate.ts
export function migrateGlobalToChannel(): string | null {
  const oldSettings = localStorage.getItem('dbd-settings');
  if (!oldSettings) return null;

  let state: { channel?: string };
  try {
    state = JSON.parse(oldSettings).state;
  } catch {
    return null;
  }

  const channel = state.channel?.toLowerCase();
  if (!channel) return null;

  // Skip if already migrated
  if (localStorage.getItem(`dbd-requests-${channel}`)) return channel;

  console.log(`Migrating global state to channel: ${channel}`);

  // Migrate requests
  const oldRequests = localStorage.getItem('dbd-requests');
  if (oldRequests) {
    localStorage.setItem(`dbd-requests-${channel}`, oldRequests);
    localStorage.removeItem('dbd-requests');
  }

  // Migrate sources
  const oldSources = localStorage.getItem('dbd-sources');
  if (oldSources) {
    localStorage.setItem(`dbd-sources-${channel}`, oldSources);
    localStorage.removeItem('dbd-sources');
  }

  return channel;
}
