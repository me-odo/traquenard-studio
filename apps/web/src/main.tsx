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
import {
  CurrentAuthoringPage,
  LabPreviewPage,
  RegisteredLabPage,
  VisualLabIndex,
} from './authoring-ui/pages.js';
import './authoring-ui/styles.css';
import './styles.css';

interface ApiEvent {
  readonly sequence: number;
  readonly kind: string;
  readonly payload: Record<string, unknown>;
}

function App() {
  if (window.location.pathname === '/runtime-proof') return <RuntimeProof />;
  if (window.location.pathname === '/lab') return <VisualLabIndex />;
  if (window.location.pathname.startsWith('/lab-preview/'))
    return <LabPreviewPage id={window.location.pathname.slice('/lab-preview/'.length)} />;
  if (window.location.pathname.startsWith('/lab/'))
    return <RegisteredLabPage id={window.location.pathname.slice('/lab/'.length)} />;
  return <CurrentAuthoringPage />;
}

function RuntimeProof() {
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
    <main className="runtime-proof">
      <header className="topbar">
        <div>
          <span className="eyebrow">RUNTIME / FOUNDATION PROOF · IR v1</span>
          <h1>Executable publish and session proof</h1>
          <small className="foundation-context">
            Preserved evidence for immutable publishing and authoritative session execution.
          </small>
        </div>
        <nav aria-label="Project navigation">
          <a href="/">Current editor</a>
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
