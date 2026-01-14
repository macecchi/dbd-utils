import { useRequests } from '../hooks/useRequests';

export function Stats() {
  const requests = useRequests();
  const pending = requests.filter(d => !d.belowThreshold && !d.done);
  const survivorCount = pending.filter(d => d.type === 'survivor').length;
  const killerCount = pending.filter(d => d.type === 'killer').length;

  return (
    <>
      <div className="stat">
        <div className="stat-value">{survivorCount}</div>
        <div className="stat-label">Survs</div>
      </div>
      <div className="stat">
        <div className="stat-value">{killerCount}</div>
        <div className="stat-label">Killers</div>
      </div>
    </>
  );
}
