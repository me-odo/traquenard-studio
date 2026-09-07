import { StrictMode, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  appendBlock,
  availableBlocks,
  publishDraft,
  sequentialDraft,
  validateDraft,
  type DraftBlock,
  type GameDraft,
} from '@traquenard/authoring-domain';
import { ParallelLab } from './parallel-lab.js';
import { ReferenceLab } from './reference-lab.js';
import './styles.css';

interface ApiEvent {
  readonly sequence: number;
  readonly kind: string;
  readonly payload: Record<string, unknown>;
}

function App() {
  if (window.location.pathname === '/lab/parallel') return <ParallelLab />;
  if (window.location.pathname === '/lab/references') return <ReferenceLab />;
  return window.location.pathname === '/lab' ? <VisualLab /> : <Studio />;
}

function Studio() {
  const [draft, setDraft] = useState<GameDraft>(sequentialDraft);
  const [query, setQuery] = useState('');
  const [artifactId, setArtifactId] = useState<string>();
  const [joinCode, setJoinCode] = useState<string>();
  const [credential, setCredential] = useState<string>();
  const [events, setEvents] = useState<readonly ApiEvent[]>([]);
  const [status, setStatus] = useState('draft');
  const nextId = useRef(1);
  const validation = useMemo(() => validateDraft(draft), [draft]);
  const palette = availableBlocks(draft).filter((entry) =>
    `${entry.label} ${entry.summary}`.toLowerCase().includes(query.toLowerCase()),
  );

  const insert = (kind: DraftBlock['kind']) => {
    try {
      setDraft((current) => appendBlock(current, kind, `author-${nextId.current++}`));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Insertion failed');
    }
  };

  const publish = async () => {
    const artifact = publishDraft(draft, 1);
    const response = await fetch('/api/artifacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(artifact),
    });
    const body = (await response.json()) as { artifactId?: string; message?: string };
    if (!response.ok || !body.artifactId) throw new Error(body.message ?? 'Publish failed');
    setArtifactId(body.artifactId);
    setStatus('published');
  };

  const host = async () => {
    if (!artifactId) return;
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ artifactId, hostName: 'Host' }),
    });
    const body = (await response.json()) as { joinCode: string; credential: string };
    setJoinCode(body.joinCode);
    setCredential(body.credential);
    setStatus('waiting-for-player');
  };

  const join = async () => {
    if (!joinCode) return;
    const response = await fetch(`/api/sessions/${joinCode}/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alex' }),
    });
    const body = (await response.json()) as {
      status: string;
      events: ApiEvent[];
      credential: string;
    };
    setCredential(body.credential);
    setEvents(body.events);
    setStatus(body.status);
  };

  const answer = async () => {
    if (!joinCode || !credential) return;
    const request = events.find((event) => event.kind === 'input.requested');
    if (!request) return;
    const options = request.payload.options as string[];
    const response = await fetch(`/api/sessions/${joinCode}/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
      body: JSON.stringify({
        protocolVersion: 1,
        commandId: 'guest-choice-1',
        kind: 'input.submit',
        operationId: request.payload.operationId,
        choice: options[0],
      }),
    });
    const body = (await response.json()) as { status: string; events: ApiEvent[] };
    setEvents(body.events);
    setStatus(body.status);
  };

  return (
    <main>
      <header className="topbar">
        <div>
          <span className="eyebrow">FOUNDING BUILD · IR v1</span>
          <h1>Traquenard Studio</h1>
        </div>
        <nav>
          <a href="/lab">Visual Lab</a>
          <span className={`status status-${status}`}>{status}</span>
        </nav>
      </header>

      <section className="workspace">
        <aside className="palette" aria-label="Block palette">
          <h2>Blocks</h2>
          <label>
            Search
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="prompt, timer…"
            />
          </label>
          <div className="palette-list">
            {palette.map((entry) => (
              <button
                key={entry.kind}
                draggable={entry.compatible}
                disabled={!entry.compatible}
                title={entry.reason ?? entry.summary}
                onDragStart={(event) =>
                  event.dataTransfer.setData('application/x-traquenard-block', entry.kind)
                }
                onClick={() => insert(entry.kind)}
              >
                <span className="block-icon" aria-hidden="true">
                  {entry.kind === 'wait' ? '◷' : entry.kind === 'end' ? '■' : '◆'}
                </span>
                <span>
                  <strong>{entry.label}</strong>
                  <small>{entry.compatible ? entry.summary : entry.reason}</small>
                </span>
              </button>
            ))}
          </div>
          <p className="hint">
            Drag a compatible block or tap it. Compatibility comes from typed requirements.
          </p>
        </aside>

        <section
          className="canvas"
          aria-label="Game flow"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const kind = event.dataTransfer.getData(
              'application/x-traquenard-block',
            ) as DraftBlock['kind'];
            if (kind) insert(kind);
          }}
        >
          <div className="canvas-heading">
            <div>
              <span className="eyebrow">GAME FLOW</span>
              <h2>{draft.title}</h2>
            </div>
            <span>{draft.blocks.length} blocks</span>
          </div>
          <ol className="flow">
            {draft.blocks.map((block, index) => (
              <li key={block.id}>
                <span className="step">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{blockLabel(block)}</strong>
                  <small>{blockSummary(block)}</small>
                </div>
                <code>{block.id}</code>
              </li>
            ))}
          </ol>
          <button className="drop-target" onClick={() => insert('display')}>
            ＋ Insert next block
          </button>
        </section>

        <aside className="inspector">
          <h2>Artifact</h2>
          <div className={validation.valid ? 'validation valid' : 'validation invalid'}>
            <strong>{validation.valid ? 'Ready to publish' : 'Needs attention'}</strong>
            <span>
              {validation.valid
                ? 'Typed graph is valid.'
                : `${validation.issues.length} validation issue(s)`}
            </span>
          </div>
          {!validation.valid && (
            <ul>
              {validation.issues.map((issue) => (
                <li key={`${issue.path}-${issue.code}`}>{issue.message}</li>
              ))}
            </ul>
          )}
          <button className="primary" disabled={!validation.valid} onClick={() => void publish()}>
            Publish immutable v1
          </button>
          {artifactId && (
            <>
              <code className="artifact-id">{artifactId}</code>
              <button onClick={() => void host()}>Host session</button>
            </>
          )}
          {joinCode && (
            <div className="session-card">
              <span>JOIN CODE</span>
              <strong>{joinCode}</strong>
              <button onClick={() => void join()}>Join Alex on second device</button>
            </div>
          )}
          {events.some((event) => event.kind === 'input.requested') && (
            <button className="primary" onClick={() => void answer()}>
              Submit Alex’s choice
            </button>
          )}
          {status === 'completed' && <p className="complete">Game completed deterministically.</p>}
          <details>
            <summary>Canonical IR preview</summary>
            <pre>{JSON.stringify(publishDraft(draft, 1).definition, null, 2)}</pre>
          </details>
        </aside>
      </section>
    </main>
  );
}

function VisualLab() {
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState(4);
  return (
    <main className="lab">
      <header className="topbar">
        <div>
          <span className="eyebrow">PRESENTATION SANDBOX</span>
          <h1>Visual Lab</h1>
        </div>
        <a href="/">← Studio</a>
      </header>
      <p>Components render predetermined runtime results; they never choose business outcomes.</p>
      <a className="experiment-link" href="/lab/parallel">
        <span className="eyebrow">AUTHORING EXPERIMENT · ISSUE #1</span>
        <strong>Compare parallel execution grammars</strong>
        <small>Lanes, fork/join, and grouped cards across four semantic fixtures →</small>
      </a>
      <a className="experiment-link" href="/lab/references">
        <span className="eyebrow">AUTHORING EXPERIMENT · ISSUE #2</span>
        <strong>Edit typed references through nested flows</strong>
        <small>Direct reference chips, reversible navigation, and optional trace tools →</small>
      </a>
      <section className="lab-grid">
        <article>
          <h2>Controlled die</h2>
          <div className="die" aria-label="Die result 5">
            ••
            <br />•<br />
            ••
          </div>
          <small>Authoritative result: 5</small>
        </article>
        <article>
          <h2>Card flip</h2>
          <button
            className={`card ${flipped ? 'flipped' : ''}`}
            onClick={() => setFlipped(!flipped)}
          >
            {flipped ? 'A ♥' : 'TRQ'}
          </button>
          <small>State-driven face</small>
        </article>
        <article>
          <h2>Score event</h2>
          <div className="score">{score}</div>
          <button onClick={() => setScore(7)}>Apply +3 event</button>
        </article>
        <article>
          <h2>Countdown</h2>
          <div className="countdown">00:03</div>
          <small>Logical time remaining</small>
        </article>
      </section>
    </main>
  );
}

function blockLabel(block: DraftBlock): string {
  return (
    availableBlocks(sequentialDraft).find((entry) => entry.kind === block.kind)?.label ?? block.kind
  );
}

function blockSummary(block: DraftBlock): string {
  switch (block.kind) {
    case 'display':
      return block.message;
    case 'ask-selected':
      return `${block.prompt} · ${block.options.join(' / ')}`;
    case 'wait':
      return `${block.durationMs} logical ms`;
    case 'select-player':
      return 'From connected participants';
    case 'end':
      return 'Terminal operation';
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
