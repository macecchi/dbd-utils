import { useState, useEffect, useRef } from 'react';
import { useChannel, SOURCES_DEFAULTS } from '../store';
import type { SourceType as AllSourceTypes } from '../store/channel';
import { DONATE_BOT_NAMES } from '../services/twitch';
import { fetchBotModStatus } from '../services/api';
import { BotModStatusDialog, type BotModDialogMode } from './BotModStatusDialog';
import { useTranslation } from '../i18n';

type SourceType = Exclude<AllSourceTypes, 'manual'>;

const SOURCE_LABEL_KEYS: Record<SourceType, 'sources.donation' | 'sources.resub' | 'sources.chat'> = {
  donation: 'sources.donation',
  resub: 'sources.resub',
  chat: 'sources.chat',
};



const SOURCE_ICONS: Record<SourceType, React.ReactNode> = {
  donation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  resub: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
};

interface SourcesPanelProps {
  onRecover?: () => void;
  onReview?: () => void;
}

export function SourcesPanel({ onRecover, onReview }: SourcesPanelProps) {
  const { t } = useTranslation();
  const { useSources, canControlConnection } = useChannel();
  const {
    enabled, chatCommand, chatTiers, priority, sortMode, minDonation, hideNonRequests, confirmInChat,
    setEnabled, setChatCommand, setChatTiers, setPriority, setMinDonation, setHideNonRequests, setConfirmInChat
  } = useSources();
  const readOnly = !canControlConnection;

  const [isOpen, setIsOpen] = useState(true);
  const [draggedItem, setDraggedItem] = useState<SourceType | null>(null);

  // Mod-status dialog — only opens when the bot isn't a mod yet:
  //   • 'enabling'  → user is trying to turn the toggle on; we block until verified.
  //   • 'lost-mod'  → toggle was already on but a session-start check found the bot
  //                    is no longer a mod (someone /unmod-ed it).
  const [dialogMode, setDialogMode] = useState<BotModDialogMode | null>(null);
  // Prevents double-running the session-start lost-mod check across remounts.
  const lostModCheckRanRef = useRef(false);
  // Tracks an in-flight "click toggle" check so we can disable the toggle visually.
  const [togglePending, setTogglePending] = useState(false);

  // Session-start verification: if the feature is already on, confirm the bot is
  // still modded. If not, surface the lost-mod dialog so the streamer can either
  // re-add the bot or turn the feature off cleanly.
  useEffect(() => {
    if (!confirmInChat || readOnly) return;
    if (lostModCheckRanRef.current) return;
    lostModCheckRanRef.current = true;

    void (async () => {
      try {
        const status = await fetchBotModStatus();
        if (status.ok && !status.is_mod) {
          setDialogMode('lost-mod');
        }
        // Other failure modes (no_bot_token, twitch_error) deliberately stay silent
        // here — the chat send path already surfaces a server-error toast on the
        // first failed message, and we don't want to nag on transient API hiccups.
      } catch {
        // Transient — same as above, stay quiet.
      }
    })();
  }, [confirmInChat, readOnly]);

  const handleConfirmInChatClick = async () => {
    if (readOnly || togglePending) return;

    // Turning OFF is always allowed without a check.
    if (confirmInChat) {
      setConfirmInChat(false);
      return;
    }

    // Turning ON — verify mod status first; only enable when confirmed.
    setTogglePending(true);
    try {
      const status = await fetchBotModStatus();
      if (status.ok && status.is_mod) {
        setConfirmInChat(true);
      } else {
        setDialogMode('enabling');
      }
    } catch {
      setDialogMode('enabling');
    } finally {
      setTogglePending(false);
    }
  };

  const handleDialogVerified = () => {
    setDialogMode(null);
    setConfirmInChat(true);
  };

  const handleDialogCancel = () => {
    setDialogMode(null);
  };

  const handleDialogTurnOff = () => {
    setDialogMode(null);
    setConfirmInChat(false);
  };

  const handleDragStart = (source: SourceType) => {
    if (readOnly) return;
    setDraggedItem(source);
  };

  const handleDragOver = (e: React.DragEvent, targetSource: SourceType) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetSource) return;
    const newPriority = [...priority].filter((s): s is SourceType => s !== 'manual');
    const draggedIdx = newPriority.indexOf(draggedItem);
    const targetIdx = newPriority.indexOf(targetSource);
    if (draggedIdx === -1 || targetIdx === -1) return;
    newPriority.splice(draggedIdx, 1);
    newPriority.splice(targetIdx, 0, draggedItem);
    setPriority([...newPriority, 'manual']);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const filteredPriority = priority.filter((s): s is SourceType => s !== 'manual');

  const getMinTier = (): number => {
    if (chatTiers.length === 0) return 1;
    return Math.min(...chatTiers);
  };

  const setMinTier = (minTier: number) => {
    setChatTiers([1, 2, 3].filter(t => t >= minTier));
  };

  const renderSourceSection = (source: SourceType) => {
    const isEnabled = enabled[source];

    return (
      <div key={source} className={`source-section source-${source} ${isEnabled ? 'enabled' : 'disabled'}`}>
        <div className="source-section-header">
          <div className="source-section-title">
            <span className="source-section-icon">{SOURCE_ICONS[source]}</span>
            <span>{t(SOURCE_LABEL_KEYS[source])}</span>
          </div>
          <label className="source-toggle">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={e => !readOnly && setEnabled({ ...enabled, [source]: e.target.checked })}
              disabled={readOnly}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {source === 'donation' && (
          <div className="source-section-body">
            <span className="source-section-desc" dangerouslySetInnerHTML={{ __html: t('sources.donationDesc', { botNames: Array.from(DONATE_BOT_NAMES).join(', ') }) }} />
            <div className="source-field">
              <label htmlFor="donation-min">{t('sources.minimum')}</label>
              <div className="input-with-prefix">
                <span>R$</span>
                <input
                  id="donation-min"
                  name="donation-min"
                  type="number"
                  defaultValue={minDonation}
                  min={0}
                  step={1}
                  onBlur={e => !readOnly && setMinDonation(parseFloat(e.target.value) || 0)}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        )}

        {source === 'resub' && (
          <div className="source-section-body">
            <span className="source-section-desc">{t('sources.resubDesc')}</span>
          </div>
        )}

        {source === 'chat' && (
          <div className="source-section-body">
            <span className="source-section-desc" dangerouslySetInnerHTML={{ __html: t('sources.chatDesc', { example: '!fila huntress' }) }} />
            <div className="source-field">
              <label htmlFor="chat-command">{t('sources.command')}</label>
              <input
                id="chat-command"
                name="chat-command"
                type="text"
                defaultValue={chatCommand}
                placeholder={SOURCES_DEFAULTS.chatCommand}
                onBlur={e => !readOnly && setChatCommand(e.target.value.trim() || SOURCES_DEFAULTS.chatCommand)}
                disabled={readOnly}
              />
            </div>
            <div className="source-field">
              <label htmlFor="chat-tier">{t('sources.minTier')}</label>
              <select id="chat-tier" name="chat-tier" value={getMinTier()} onChange={e => !readOnly && setMinTier(Number(e.target.value))} disabled={readOnly}>
                <option value={1}>{t('sources.tier1')}</option>
                <option value={2}>{t('sources.tier2')}</option>
                <option value={3}>{t('sources.tier3')}</option>
              </select>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className={`sources-panel ${isOpen ? 'open' : ''}`} id="sourcesPanel">
      <div className="sources-panel-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="sources-panel-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          {t('sources.title')}
        </span>
        <span className="sources-panel-toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>

      <div className="sources-panel-body">
        <div className="sources-panel-body-inner">
        <div className="source-sections">
          {(['donation', 'chat', 'resub'] as SourceType[]).map(renderSourceSection)}
        </div>

        <div className="settings-row">
          <div className={`priority-section${sortMode === 'fifo' ? ' disabled' : ''}`}>
            <div className="priority-header">{t('sources.sortOrder')}</div>
            <p className="priority-desc">
              {sortMode === 'fifo' ? t('sources.sortFifoDesc') : t('sources.sortPriorityDesc')}
            </p>
            <p className="priority-desc">
              {t('sources.priority')}
            </p>
            <div className="priority-pills">
              {filteredPriority.map((source: SourceType, idx: number) => (
                <div
                  key={source}
                  className={`priority-pill ${source} ${draggedItem === source ? 'dragging' : ''}`}
                  draggable={!readOnly}
                  onDragStart={() => handleDragStart(source)}
                  onDragOver={e => handleDragOver(e, source)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="priority-pill-num">{idx + 1}</span>
                  <span className="priority-pill-icon">{SOURCE_ICONS[source]}</span>
                  <span className="priority-pill-label">{t(SOURCE_LABEL_KEYS[source])}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="priority-section">
            <div className="priority-header">{t('sources.hideNonRequests')}</div>
            <p className="priority-desc">
              {t('sources.hideNonRequestsDesc')}
            </p>
            <label className="source-toggle">
              <input
                type="checkbox"
                checked={hideNonRequests}
                onChange={() => !readOnly && setHideNonRequests(!hideNonRequests)}
                disabled={readOnly}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="priority-section">
            <div className="priority-header">{t('chatConfirm.toggle')}</div>
            <p className="priority-desc">
              {t('chatConfirm.toggleDesc')}
            </p>
            <label className="source-toggle">
              <input
                type="checkbox"
                checked={confirmInChat}
                onChange={() => void handleConfirmInChatClick()}
                disabled={readOnly || togglePending}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {!readOnly && (onRecover || onReview) && (
          <div className="recover-section">
            {onReview && (
              <button className="btn btn-ghost recover-btn" onClick={onReview}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 3v18" />
                </svg>
                {t('sources.reviewRequests')}
              </button>
            )}
            {onRecover && (
              <button className="btn btn-ghost recover-btn" onClick={onRecover}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
                {t('sources.recoverVod')}
              </button>
            )}
          </div>
        )}
        </div>
      </div>

      <BotModStatusDialog
        isOpen={dialogMode !== null}
        mode={dialogMode ?? 'enabling'}
        onVerified={handleDialogVerified}
        onCancel={handleDialogCancel}
        onTurnOff={handleDialogTurnOff}
      />
    </section>
  );
}
