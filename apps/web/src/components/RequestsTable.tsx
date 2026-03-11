import type { ReactNode, MouseEvent } from 'react';
import { CharacterAvatar } from './CharacterAvatar';
import { getKillerPortrait } from '../data/characters';
import type { Request } from '../types';

const SOURCE_LABELS: Record<string, string> = {
  donation: 'Donate',
  chat: 'Chat',
  resub: 'Resub',
  manual: 'Manual',
};

export function formatSourceBadge(req: Pick<Request, 'source' | 'amount' | 'subTier'>): string {
  if (req.source === 'donation' && req.amount) return req.amount;
  if (req.source === 'chat' && req.subTier) return `Tier ${req.subTier}`;
  return SOURCE_LABELS[req.source] ?? req.source;
}

export interface RequestsTableColumn {
  key: string;
  header: ReactNode;
  className?: string;
  render: (req: Request, index: number) => ReactNode;
}

interface Props {
  requests: Request[];
  leadColumns?: RequestsTableColumn[];
  trailColumns?: RequestsTableColumn[];
  showId?: boolean;
  showMessage?: boolean;
  showTimestamp?: boolean;
  onRowClick?: (index: number, e: MouseEvent) => void;
  rowClassName?: (req: Request, index: number) => string | undefined;
  emptyText?: string;
}

const TIME_FMT: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };

export function RequestsTable({
  requests,
  leadColumns,
  trailColumns,
  showId = false,
  showMessage = true,
  showTimestamp = true,
  onRowClick,
  rowClassName,
  emptyText = 'Nenhum pedido.',
}: Props) {
  if (requests.length === 0) {
    if (!emptyText) return null;
    return (
      <div className="dialog-empty">
        <span>{emptyText}</span>
      </div>
    );
  }

  return (
    <table className="req-table">
      <thead>
        <tr>
          {leadColumns?.map(col => (
            <th key={col.key} className={col.className}>{col.header}</th>
          ))}
          {showId && <th className="req-col-id">ID</th>}
          <th className="req-col-char">Personagem</th>
          <th className="req-col-donor">Doador</th>
          <th className="req-col-source">Fonte</th>
          {showMessage && <th className="req-col-msg">Mensagem</th>}
          {showTimestamp && <th className="req-col-dates">Horário</th>}
          {trailColumns?.map(col => (
            <th key={col.key} className={col.className}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {requests.map((r, i) => {
          const portrait = r.type === 'killer' && r.character ? getKillerPortrait(r.character) : undefined;
          return (
            <tr
              key={r.id}
              className={rowClassName?.(r, i)}
              onClick={onRowClick ? e => onRowClick(i, e) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {leadColumns?.map(col => (
                <td key={col.key} className={col.className}>{col.render(r, i)}</td>
              ))}
              {showId && <td className="req-col-id mono">{r.id}</td>}
              <td className="req-col-char">
                <div className="req-char-wrap">
                  <CharacterAvatar portrait={portrait} type={r.type} size="sm" />
                  <span className="req-char-name" title={r.character || undefined}>
                    {r.character || <span className="text-muted">—</span>}
                  </span>
                </div>
              </td>
              <td className="req-col-donor">{r.donor}</td>
              <td className="req-col-source">
                <span className={`amount source-${r.source}`}>
                  {formatSourceBadge(r)}
                </span>
              </td>
              {showMessage && (
                <td className="req-col-msg">
                  <span className="req-msg-text">{r.message || <span className="text-muted">—</span>}</span>
                </td>
              )}
              {showTimestamp && (
                <td className="req-col-dates mono">
                  {r.timestamp.toLocaleString('pt-BR', TIME_FMT)}
                </td>
              )}
              {trailColumns?.map(col => (
                <td key={col.key} className={col.className}>{col.render(r, i)}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
