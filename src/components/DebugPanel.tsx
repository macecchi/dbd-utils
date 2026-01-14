import { useState, FormEvent } from 'react';
import { testExtraction, reidentifyAll, clearAllDonations, loadAndReplayVOD, cancelVODReplay } from '../services';
import { loadMockData } from '../data/mock-donations';

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [addToQueue, setAddToQueue] = useState(false);
  const [result, setResult] = useState<{ text: string; show: boolean }>({ text: '', show: false });
  const [vodId, setVodId] = useState('');
  const [speed, setSpeed] = useState(0);
  const [vodStatus, setVodStatus] = useState('');
  const [isReplaying, setIsReplaying] = useState(false);

  const handleTest = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setResult({ text: 'Identificando...', show: true });

    const res = await testExtraction(input, addToQueue);
    const prefix = res.isLocal ? '[local]' : '[IA]';
    const color = res.type === 'survivor' ? 'var(--blue)' : res.type === 'killer' ? 'var(--red)' : 'var(--text-muted)';
    const display = res.character || res.type;

    setResult({
      text: `<span style="color:var(--text-muted)">${prefix}</span> <span style="color:${color}">${res.type}</span> → <strong>${display}</strong>`,
      show: true
    });

    if (addToQueue && res.type !== 'unknown') {
      setInput('');
    }
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

    try {
      await loadAndReplayVOD(vodId, speed, setVodStatus);
    } catch (e: any) {
      setVodStatus(`Error: ${e.message}`);
    }

    setIsReplaying(false);
  };

  return (
    <section className={`settings ${open ? 'open' : ''}`}>
      <div className="settings-header" onClick={() => setOpen(!open)}>
        <span className="settings-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Debug
        </span>
        <span className="settings-toggle">▼</span>
      </div>
      <div className="settings-body">
        <form className="debug-row" onSubmit={handleTest}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite uma mensagem para testar extração de personagem"
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={addToQueue} onChange={e => setAddToQueue(e.target.checked)} />
            Adicionar à fila
          </label>
          <button className="btn btn-ghost" type="submit">Testar</button>
        </form>
        {result.show && (
          <div className="debug-result show" dangerouslySetInnerHTML={{ __html: result.text }} />
        )}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost" onClick={() => reidentifyAll()} style={{ marginTop: '0.5rem' }}>
            Re-identificar todos
          </button>
          <button className="btn btn-ghost" onClick={() => clearAllDonations()} style={{ marginTop: '0.5rem' }}>
            Limpar tudo
          </button>
          <button className="btn btn-ghost" onClick={() => loadMockData()} style={{ marginTop: '0.5rem' }}>
            Carregar mock
          </button>
        </div>
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Replay VOD Chat</div>
          <div className="debug-row">
            <input
              type="text"
              value={vodId}
              onChange={e => setVodId(e.target.value)}
              placeholder="VOD ID (ex: 2345678901)"
            />
            <select value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ width: '100px' }}>
              <option value={0}>Instant</option>
              <option value={100}>10x</option>
              <option value={200}>5x</option>
              <option value={1000}>1x</option>
            </select>
            <button className="btn btn-ghost" type="button" onClick={handleVODReplay}>
              {isReplaying ? 'Stop' : 'Replay'}
            </button>
          </div>
          {vodStatus && <div className="debug-result show">{vodStatus}</div>}
        </div>
      </div>
    </section>
  );
}
