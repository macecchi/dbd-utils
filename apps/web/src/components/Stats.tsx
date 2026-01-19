import { useRequests } from '../store';

export function Stats() {
  const requests = useRequests((s) => s.requests);
  const pending = requests.filter(d => !d.done);
  const survivorCount = pending.filter(d => d.type === 'survivor').length;
  const killerCount = pending.filter(d => d.type === 'killer').length;

  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-value">{survivorCount}</div>
        <div className="stat-label">Survs</div>
      </div>
      <div className="stat">
        <div className="stat-value">{killerCount}</div>
        <div className="stat-label">Killers</div>
      </div>
    </div>
  );
}
