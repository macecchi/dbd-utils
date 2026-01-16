interface Props {
  portrait?: string;
  type: string;
  size?: 'sm' | 'md';
}

export function CharacterAvatar({ portrait, type, size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'char-portrait-sm' : '';

  if (type === 'killer' && portrait) {
    return (
      <div className={`char-portrait-wrapper ${sizeClass}`}>
        <div className="char-portrait-bg killer"></div>
        <img src={portrait} alt="" className="char-portrait" />
      </div>
    );
  }

  const placeholder = type === 'killer' ? '/images/IconKiller.webp' :
                       type === 'survivor' ? '/images/IconSurv.webp' :
                       '/images/IconShuffle.webp';
  return (
    <div className={`char-portrait-wrapper char-portrait-placeholder ${sizeClass}`}>
      <img src={placeholder} alt="" className="char-portrait" />
    </div>
  );
}
