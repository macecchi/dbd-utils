import { useAuth } from '../store/auth';
import type { SerializedRequest } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export async function fetchRequestsHistory(channel: string): Promise<SerializedRequest[]> {
  const token = await useAuth.getState().getAccessToken();
  if (!token) throw new Error('not_authenticated');

  const res = await fetch(`${API_URL}/api/rooms/${channel.toLowerCase()}/requests`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`fetch_failed:${res.status}`);
  }

  const data = await res.json() as { requests: SerializedRequest[] };
  return data.requests;
}
