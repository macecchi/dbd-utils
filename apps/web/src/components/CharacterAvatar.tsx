interface Props {
  portrait?: string;
  type: string;
  size?: 'sm' | 'md';
}

const base = import.meta.env.BASE_URL;
const portraitBg = `url('${base}images/CharPortrait_bg.webp')`;
const roleBg = `url('${base}images/CharPortrait_roleBG.webp')`;

export function CharacterAvatar({ portrait, type, size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'char-portrait-sm' : '';

  if (type === 'killer' && portrait) {
    return (
      <div className={`char-portrait-wrapper ${sizeClass}`} style={{ backgroundImage: portraitBg }}>
        <div className="char-portrait-bg killer" style={{ WebkitMaskImage: roleBg, maskImage: roleBg }}></div>
        <img src={portrait} alt="" className="char-portrait" />
      </div>
    );
  }

  const placeholderIcon = type === 'killer' ? 'IconKiller.webp' :
                          type === 'survivor' ? 'IconSurv.webp' :
                          'IconShuffle.webp';
  const placeholder = `${base}images/${placeholderIcon}`;
  return (
    <div className={`char-portrait-wrapper char-portrait-placeholder ${sizeClass}`} style={{ backgroundImage: portraitBg }}>
      <img src={placeholder} alt="" className="char-portrait" />
    </div>
  );
}
