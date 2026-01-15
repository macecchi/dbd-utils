interface Props {
  portrait?: string;
  type: string;
  size?: 'sm' | 'md';
}

export function CharacterAvatar({ portrait, type, size = 'md' }: Props) {
  if (type !== 'killer' || !portrait) return null;

  return (
    <div className={`char-portrait-wrapper ${size === 'sm' ? 'char-portrait-sm' : ''}`}>
      <div className="char-portrait-bg killer"></div>
      <img src={portrait} alt="" className="char-portrait" />
    </div>
  );
}
