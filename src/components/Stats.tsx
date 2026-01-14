import { useDonations } from '../hooks/useDonations';

export function Stats() {
  const donations = useDonations();
  const pending = donations.filter(d => !d.belowThreshold && !d.done);
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
