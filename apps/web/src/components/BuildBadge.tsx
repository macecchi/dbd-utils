import { useEffect, useState } from 'react';

interface Props {
  size?: 'sm' | 'md';
}

const base = import.meta.env.BASE_URL;
const perkSlotUrl = `${base}images/perk.webp`;

// Probed once per page load: does a perk.webp asset exist? If yes, all
// BuildBadge instances render the image; if not, they fall back to the
// CSS diamond styling. Cached in module scope so subsequent badges don't
// re-probe.
let perkAssetState: 'unknown' | 'present' | 'missing' = 'unknown';
const subscribers = new Set<() => void>();

function probePerkAsset() {
  if (perkAssetState !== 'unknown') return;
  const img = new Image();
  img.onload = () => { perkAssetState = 'present'; subscribers.forEach(fn => fn()); };
  img.onerror = () => { perkAssetState = 'missing'; subscribers.forEach(fn => fn()); };
  img.src = perkSlotUrl;
}

function usePerkAsset(): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    if (perkAssetState === 'unknown') probePerkAsset();
    const cb = () => force(n => n + 1);
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
  }, []);
  return perkAssetState === 'present';
}

/**
 * Four empty perk slots arranged in the canonical DBD loadout diamond:
 *
 *      ◇
 *    ◇   ◇
 *      ◇
 *
 * Renders bottom-right of the avatar. If `apps/web/public/images/perk.webp`
 * exists, the slot background uses the image (via the
 * `[data-perk-asset="true"]` CSS selector). Otherwise the slots fall back
 * to a pure-CSS diamond approximation — see `.build-badge-slot` in
 * styles/requests.css.
 *
 * Tooltip is provided by the parent (CharacterAvatar) listening for
 * pointer/touch events on the entire avatar wrapper, so this component
 * is purely visual.
 */
export function BuildBadge({ size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'build-badge-sm' : '';
  const hasAsset = usePerkAsset();
  return (
    <div
      className={`build-badge ${sizeClass}`}
      data-perk-asset={hasAsset ? 'true' : undefined}
      aria-hidden="true"
    >
      <span className="build-badge-slot build-badge-top" />
      <span className="build-badge-slot build-badge-left" />
      <span className="build-badge-slot build-badge-right" />
      <span className="build-badge-slot build-badge-bottom" />
    </div>
  );
}
