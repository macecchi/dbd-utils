interface Props {
  size?: 'sm' | 'md';
}

/**
 * Four empty perk slots arranged in the canonical DBD loadout diamond:
 *
 *      ◇
 *    ◇   ◇
 *      ◇
 *
 * Renders bottom-right of the avatar. Slots are pure-CSS diamond shapes
 * (no image asset required) — see `.build-badge-slot` styling in
 * styles/requests.css.
 *
 * Tooltip is provided by the parent (CharacterAvatar) listening for
 * pointer/touch events on the entire avatar wrapper, so this component
 * is purely visual.
 */
export function BuildBadge({ size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'build-badge-sm' : '';
  return (
    <div className={`build-badge ${sizeClass}`} aria-hidden="true">
      <span className="build-badge-slot build-badge-top" />
      <span className="build-badge-slot build-badge-left" />
      <span className="build-badge-slot build-badge-right" />
      <span className="build-badge-slot build-badge-bottom" />
    </div>
  );
}
