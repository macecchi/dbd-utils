import type { HTMLAttributes, ReactNode } from 'react';

type PanelTag = 'section' | 'div' | 'aside';

interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: PanelTag;
  children: ReactNode;
}

/**
 * Base surface for the main layout cards (queue, channel header, settings, debug).
 * Provides consistent bg, border, radius, overflow clipping, and the .elevated-surface
 * shadow stack. Pass `className` to layer on layout-specific rules (flex direction,
 * inner padding, etc.).
 */
export function Panel({ as: Tag = 'section', className = '', children, ...rest }: PanelProps) {
  return (
    <Tag className={`panel-surface elevated-surface ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

interface PanelHeaderProps {
  /** Optional leading icon (SVG, img, etc.) shown left of the title. */
  icon?: ReactNode;
  /** Title content. Plain string or composed JSX (e.g. title + inline badges). */
  children: ReactNode;
  /** Optional right-side cluster (action buttons, counts, etc.). */
  actions?: ReactNode;
}

/**
 * Standard panel header — used by the queue, settings, and debug panels for a
 * consistent title row (icon + title on the left, optional actions on the right).
 */
export function PanelHeader({ icon, children, actions }: PanelHeaderProps) {
  return (
    <div className="panel-header">
      <div className="panel-title">
        {icon && <span className="panel-title-icon">{icon}</span>}
        {children}
      </div>
      {actions && <div className="panel-actions">{actions}</div>}
    </div>
  );
}
