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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!build) return;
    e.stopPropagation();
    setShowTooltip(prev => !prev);
  };
  const handleMouseEnter = () => { if (build) setShowTooltip(true); };
  const handleMouseLeave = () => { setShowTooltip(false); };

  const innerProps = {
    ref: wrapperRef,
    onTouchStart: handleTouchStart,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };

  if (type === 'killer' && portrait) {
    return (
      <div className={`char-portrait-wrapper ${sizeClass}`} style={{ backgroundImage: portraitBg }} {...innerProps}>
        <div className="char-portrait-bg killer" style={{ WebkitMaskImage: roleBg, maskImage: roleBg }}></div>
        <img src={portrait} alt="" className="char-portrait" />
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
    <div className={`char-portrait-wrapper char-portrait-placeholder ${sizeClass}`} style={{ backgroundImage: portraitBg }} {...innerProps}>
      <img src={placeholder} alt="" className="char-portrait" />
      {build && <BuildBadge size={size} />}
      {build && showTooltip && <div className="build-tooltip" role="tooltip">{build.text}</div>}
    </div>
  );
}
