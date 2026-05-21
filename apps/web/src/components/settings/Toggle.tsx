import type { ButtonHTMLAttributes } from 'react';

interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  checked: boolean;
}

export function Toggle({ checked, className = '', ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      className={`settings-toggle ${checked ? 'on' : ''} ${className}`.trim()}
      aria-pressed={checked}
      {...rest}
    />
  );
}
