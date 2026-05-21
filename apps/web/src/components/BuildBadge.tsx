interface Props {
  size?: 'sm' | 'md';
}

const perkSlotUrl = `${import.meta.env.BASE_URL}images/perk.webp`;

/**
 * Four perk slots arranged in the canonical DBD loadout diamond:
 *
 *      ◇
 *    ◇   ◇
 *      ◇
 *
 * Single SVG with four <image> references to `images/perk.webp`. The browser
 * fetches the asset once and reuses the decoded bitmap for all four slots, so
 * this is one DOM element + one network request regardless of how many badges
 * render. CSS still owns positioning of the badge on the avatar (see
 * `.build-badge` in styles/requests.css).
 *
 * Tooltip is provided by the parent (CharacterAvatar) listening for
 * pointer/touch events on the entire avatar wrapper, so this component is
 * purely visual.
 */
export function BuildBadge({ size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'build-badge-sm' : '';
  // viewBox is 100×100 with each slot 50×50, arranged in a diamond. Slots
  // touch corner-to-corner at the center, matching the DBD in-game layout.
  return (
    <svg
      className={`build-badge ${sizeClass}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <image href={perkSlotUrl} x="25" y="0"  width="50" height="50" />
      <image href={perkSlotUrl} x="0"  y="25" width="50" height="50" />
      <image href={perkSlotUrl} x="50" y="25" width="50" height="50" />
      <image href={perkSlotUrl} x="25" y="50" width="50" height="50" />
    </svg>
  );
}
