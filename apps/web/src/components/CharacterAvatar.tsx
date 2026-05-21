import { useState, useRef, useEffect } from 'react';
import type { RequestExtra } from '../types';
import { BuildBadge } from './BuildBadge';

interface Props {
  portrait?: string;
  type: string;
  size?: 'sm' | 'md';
  extras?: RequestExtra[];
}

const base = import.meta.env.BASE_URL;
const portraitBg = `url('${base}images/CharPortrait_bg.webp')`;
const roleBg = `url('${base}images/CharPortrait_roleBG.webp')`;

function getBuild(extras?: RequestExtra[]): { text: string } | null {
  if (!extras) return null;
  const b = extras.find(e => e.type === 'build');
  return b ? { text: b.text } : null;
}

export function CharacterAvatar({ portrait, type, size = 'md', extras }: Props) {
  const sizeClass = size === 'sm' ? 'char-portrait-sm' : '';
  const build = getBuild(extras);
  const [showTooltip, setShowTooltip] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showTooltip) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showTooltip]);

  // Touch devices: a tap on the avatar opens the tooltip instead of marking
  // the card done. Desktop (hover-capable) keeps the existing mark-done click
  // and surfaces the tooltip on hover. Detecting via `(hover: hover)` rather
  // than ad-hoc UA checks avoids false positives on stylus/hybrid devices.
  const handleClick = (e: React.MouseEvent) => {
    if (!build) return;
    const hoverCapable = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;
    if (hoverCapable) return; // let the click bubble to the card → mark done
    e.stopPropagation();
    setShowTooltip(prev => !prev);
  };
  const handleMouseEnter = () => { if (build) setShowTooltip(true); };
  const handleMouseLeave = () => { setShowTooltip(false); };

  const interactionProps = {
    ref: wrapperRef,
    onClick: handleClick,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };

  // The wrapper is the positioning context for the badge + tooltip and must NOT
  // clip them (badge sits at bottom: -6px, tooltip below the avatar). The inner
  // clip div preserves the existing image-masking behavior for the portrait/role
  // background without affecting overlay children.
  if (type === 'killer' && portrait) {
    return (
      <div className={`char-portrait-wrapper ${sizeClass}`} {...interactionProps}>
        <div className="char-portrait-clip" style={{ backgroundImage: portraitBg }}>
          <div className="char-portrait-bg killer" style={{ WebkitMaskImage: roleBg, maskImage: roleBg }}></div>
          <img src={portrait} alt="" className="char-portrait" />
        </div>
        {build && <BuildBadge size={size} />}
        {build && showTooltip && <div className="build-tooltip" role="tooltip">{build.text}</div>}
      </div>
    );
  }

  const placeholderIcon = type === 'killer' ? 'IconKiller.webp' :
                          type === 'survivor' ? 'IconSurv.webp' :
                          'IconShuffle.webp';
  const placeholder = `${base}images/${placeholderIcon}`;
  return (
    <div className={`char-portrait-wrapper char-portrait-placeholder ${sizeClass}`} {...interactionProps}>
      <div className="char-portrait-clip" style={{ backgroundImage: portraitBg }}>
        <img src={placeholder} alt="" className="char-portrait" />
      </div>
      {build && <BuildBadge size={size} />}
      {build && showTooltip && <div className="build-tooltip" role="tooltip">{build.text}</div>}
    </div>
  );
}
