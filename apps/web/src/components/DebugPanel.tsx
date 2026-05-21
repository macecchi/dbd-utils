import { useState, FormEvent } from 'react';
import { testExtraction, loadAndReplayVOD, cancelVODReplay, identifyCharacter } from '../services';
import type { VODCallbacks } from '../services';
import type { Request } from '../types';
import { loadMockData } from '../data/mock-requests';
import { CHARACTERS } from '../data/characters';
import { toast } from 'sonner';
import { useChannel, useAuth } from '../store';
import { DONATE_BOT_NAMES, simulateDisconnect } from '../services/twitch';
import { useTranslation } from '../i18n';
import { Panel, PanelHeader } from './Panel';

export function DebugPanel() {
  const { useRequests, useSources, canControlConnection } = useChannel();
  const { requests, update, setAll: setRequests, add: addRequest } = useRequests();
  const { isAuthenticated } = useAuth();
  const { enabled: sourcesEnabled, chatTiers, chatCommand, minDonation } = useSources();
  const readOnly = !canControlConnection;
  const showToast = (msg: string, title: string, _color?: string) => toast.error(title, { description: msg });
  const { t } = useTranslation();

  const allNames = CHARACTERS.killers.map(c => c.name);
  const randomMsg = () => allNames[Math.floor(Math.random() * allNames.length)];
  const randomDonor = () => `TestUser${Math.floor(Math.random() * 1000)}`;

  const simulateIRC = (type: 'donation-above' | 'donation-below' | 'resub' | 'chat-sub' | 'chat-nosub') => {
    const msg = randomMsg();
    const donor = randomDonor();
    const before = useRequests.getState().requests.length;

    switch (type) {
      case 'donation-above':
        window.dbdDebug.donate(donor, minDonation + 10, msg);
        break;
      case 'donation-below':
        window.dbdDebug.donate(donor, Math.max(minDonation - 5, 1), msg);
        break;
      case 'resub':
        window.dbdDebug.resub(donor, msg);
        break;
      case 'chat-sub': {
        const tier = chatTiers.length > 0 ? Math.min(...chatTiers) : 1;
        window.dbdDebug.chat(donor, `${chatCommand} ${msg}`, { sub: true, tier });
        break;
      }
      case 'chat-nosub':
        window.dbdDebug.chat(donor, `${chatCommand} ${msg}`, { sub: false });
        break;
    }

    const showResult = (added: boolean) => setSimResult({
      text: `<span style="color:${added ? 'var(--green)' : 'var(--text-muted)'}">${type}: ${added ? 'added' : 'filtered'}</span> <span style="color:var(--text-muted)">(${msg})</span>`,
      show: true
    });

    // Store updates async (server roundtrip), so wait briefly for the echo
    const unsub = useRequests.subscribe((s) => {
      if (s.requests.length > before) {
        showResult(true);
        unsub();
        clearTimeout(timer);
      }
    });
    const timer = setTimeout(() => { unsub(); showResult(false); }, 2000);
  };

  const [input, setInput] = useState('');
  const [addToQueue, setAddToQueue] = useState(true);
  const [result, setResult] = useState<{ text: string; show: boolean }>({ text: '', show: false });
  const [simResult, setSimResult] = useState<{ text: string; show: boolean }>({ text: '', show: false });
  const [vodId, setVodId] = useState('');
  const [speed, setSpeed] = useState(0);
  const [vodStatus, setVodStatus] = useState('');
  const [isReplaying, setIsReplaying] = useState(false);

  const vodConfig = { botNames: DONATE_BOT_NAMES, minDonation, sourcesEnabled };

  const handleTest = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const message = input;

    // Push the request through the real donate IRC pipeline so it gets source='donation',
    // a random user as donor, and goes through the normal LLM identification + chat
    // confirmation flow — same path the simulated donate buttons use.
    if (addToQueue) {
      window.dbdDebug.donate(randomDonor(), minDonation + 10, message);
      setInput('');
    }

    setResult({ text: t('card.identifying'), show: true });

    const formatResult = (res: { character: string; type: string }, isLocal: boolean, llmSuffix = '') => {
      const prefix = isLocal ? '[local]' : '[IA]';
      const color = res.type === 'survivor' ? 'var(--blue)' : res.type === 'killer' ? 'var(--red)' : 'var(--text-muted)';
      const display = res.character || res.type;
      return `<span style="color:var(--text-muted)">${prefix}</span> <span style="color:${color}">${res.type}</span> → <strong>${display}</strong>${llmSuffix}`;
    };

    // Diagnostic-only call: shows local vs LLM extraction inline. The queued request (if any)
    // gets identified independently by App.tsx via the needsIdentification flag.
    const res = await testExtraction(
      message,
      (msg) => showToast(msg, t('debug.errorLlm'), 'red'),
      (llmRes) => {
        const isDiff = llmRes.character !== res.character;
        const llmColor = llmRes.type === 'survivor' ? 'var(--blue)' : llmRes.type === 'killer' ? 'var(--red)' : 'var(--text-muted)';
        const llmSuffix = isDiff
          ? ` <span style="color:var(--text-muted)">→ [IA]</span> <span style="color:${llmColor}">${llmRes.type}</span> → <strong>${llmRes.character}</strong>`
          : ' <span style="color:var(--green)">✓ IA confirmou</span>';
        setResult({ text: formatResult(res, res.isLocal, llmSuffix), show: true });
      }
    );

    // Only show "validando" for ambiguous local matches that will get AI validation
    const showValidating = res.isLocal && res.ambiguous && isAuthenticated;
    setResult({ text: formatResult(res, res.isLocal, showValidating ? ' <span style="color:var(--text-muted)">⏳ validando...</span>' : ''), show: true });
  };

  const handleReidentifyAll = async () => {
    for (const d of requests) {
      update(d.id, { character: 'Identificando...', type: 'unknown' });
    }
    for (const d of requests) {
      const result = await identifyCharacter(d, (msg) => showToast(msg, t('debug.errorLlm'), 'red'));
      update(d.id, result);
    }
  };

  const handleClearAll = () => {
    setRequests([]);
  };

  const handleLoadMock = () => {
    loadMockData((fn) => {
      const newRequests = fn([]);
      setRequests(newRequests);
    });
  };

  const handleVODReplay = async () => {
    if (isReplaying) {
      cancelVODReplay();
      setIsReplaying(false);
      setVodStatus('Cancelled');
      return;
    }

    if (!vodId.trim()) return;

    setIsReplaying(true);
    setVodStatus('Fetching...');

    const callbacks: VODCallbacks = {
      onStatus: setVodStatus,
      onRequest: addRequest
    };

    try {
      await loadAndReplayVOD(vodId, speed, vodConfig, callbacks);
    } catch (e: any) {
      setVodStatus(`Error: ${e.message}`);
    }

    setIsReplaying(false);
  };

  return (
    <Panel className="settings">
      <PanelHeader
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m8 2 1.88 1.88" />
            <path d="M14.12 3.88 16 2" />
            <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
            <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
            <path d="M12 20v-9" />
            <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
            <path d="M6 13H2" />
            <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
            <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
            <path d="M22 13h-4" />
            <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
          </svg>
        }
      >
        {t('debug.title')}
      </PanelHeader>
      <div className="settings-body">
        <form className="debug-row" onSubmit={handleTest}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('debug.testPlaceholder')}
          />
          {!readOnly && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={addToQueue} onChange={e => setAddToQueue(e.target.checked)} />
              {t('debug.addToQueue')}
            </label>
          )}
          <button className="btn btn-ghost" type="submit">{t('debug.test')}</button>
        </form>
        {result.show && (
          <div className="debug-result show" dangerouslySetInnerHTML={{ __html: result.text }} />
        )}
        {!readOnly && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('debug.simulateRequest')}</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={() => simulateIRC('donation-above')}>
                {t('debug.donateAbove')}
              </button>
              <button className="btn btn-ghost" onClick={() => simulateIRC('donation-below')}>
                {t('debug.donateBelow')}
              </button>
              <button className="btn btn-ghost" onClick={() => simulateIRC('resub')}>
                {t('debug.resub')}
              </button>
              <button className="btn btn-ghost" onClick={() => simulateIRC('chat-sub')}>
                {t('debug.chatSub')}
              </button>
              <button className="btn btn-ghost" onClick={() => simulateIRC('chat-nosub')}>
                {t('debug.chatNoSub')}
              </button>
            </div>
            {simResult.show && (
              <div className="debug-result show" style={{ marginTop: '0.5rem' }} dangerouslySetInnerHTML={{ __html: simResult.text }} />
            )}
          </div>
        )}
        {!readOnly && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={handleReidentifyAll}>
              {t('debug.reidentifyAll')}
            </button>
            <button className="btn btn-ghost" onClick={handleClearAll}>
              {t('debug.clearAll')}
            </button>
            <button className="btn btn-ghost" onClick={() => useSources.getState().setRecoveryCheckpoint('', 0)}>
              {t('debug.resetRecovery')}
            </button>
            <button className="btn btn-ghost" onClick={handleLoadMock}>
              {t('debug.loadMock')}
            </button>
            <button className="btn btn-ghost" onClick={() => simulateDisconnect()}>
              {t('debug.simulateDisconnect')}
            </button>
            <button className="btn btn-ghost" onClick={() => setTimeout(() => simulateDisconnect(true), 3000)}>
              {t('debug.simulatePermDisconnect')}
            </button>
          </div>
        )}
        {!readOnly && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('debug.vodReplay')}</div>
            <div className="debug-row">
              <input
                type="text"
                value={vodId}
                onChange={e => setVodId(e.target.value)}
                placeholder={t('debug.vodPlaceholder')}
              />
              <select value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ width: '100px' }}>
                <option value={0}>Instant</option>
                <option value={100}>10x</option>
                <option value={200}>5x</option>
                <option value={1000}>1x</option>
              </select>
              <button className="btn btn-ghost" type="button" onClick={handleVODReplay}>
                {isReplaying ? t('debug.stop') : t('debug.replay')}
              </button>
            </div>
            {vodStatus && <div className="debug-result show">{vodStatus}</div>}
          </div>
        )}
      </div>
    </Panel>
  );
}
