import { useLayoutEffect, useRef, useState } from 'react';
import { currentAuthoringBaseline } from './baseline.js';
import { deviceProfiles, normalizedLabState, type LabManifest } from './registry.js';
import { clearReviewSessionDefinition, labReviewSessionIdentity } from './state/review-session.js';

export function LabHarness({ manifest }: { readonly manifest: LabManifest }) {
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search));
  const state = normalizedLabState(manifest, search);
  const profile = deviceProfiles[state.device];
  const stageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [copied, setCopied] = useState(false);
  const canonicalSearch = new URLSearchParams();
  canonicalSearch.set('device', state.device);
  canonicalSearch.set('fixture', state.fixture);
  for (const [key, value] of Object.entries(state.configuration)) canonicalSearch.set(key, value);
  const canonicalQuery = canonicalSearch.toString();

  useLayoutEffect(() => {
    if (window.location.search.slice(1) !== canonicalQuery)
      window.history.replaceState(null, '', `${manifest.route}?${canonicalQuery}`);
  }, [canonicalQuery, manifest.route]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const resize = () => {
      if (!stage) return;
      setScale(Math.min(1, Math.max(0.2, (stage.clientWidth - 24) / profile.width)));
    };
    resize();
    if (!stage) return;
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [profile.width]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(canonicalSearch);
    next.set(key, value);
    window.history.replaceState(null, '', `${window.location.pathname}?${next.toString()}`);
    setSearch(next);
    setCopied(false);
  };
  const previewUrl = `/lab-preview/${manifest.id}?${canonicalQuery}`;
  const reviewUrl = `${window.location.origin}${manifest.route}?${canonicalQuery}`;

  return (
    <main className="lab-harness" data-lab-id={manifest.id} data-baseline={manifest.baselineId}>
      <header className="lab-harness-header">
        <div>
          <a href="/lab">← Visual Lab</a>
          <span className="lab-harness-eyebrow">
            ISSUE #{manifest.issue} · {manifest.status.toUpperCase()}
          </span>
          <h1>{manifest.title}</h1>
        </div>
        <a href="/" className="lab-harness-root-link">
          Current editor
        </a>
      </header>
      <section className="lab-harness-research" aria-label="Experiment controls">
        <div className="lab-harness-control">
          <strong>Device</strong>
          <div className="lab-harness-segmented">
            {manifest.deviceProfiles.map((id) => (
              <button
                key={id}
                aria-pressed={state.device === id}
                onClick={() => update('device', id)}
              >
                {deviceProfiles[id].label}
              </button>
            ))}
          </div>
        </div>
        {manifest.fixtures.length > 1 && (
          <label className="lab-harness-control">
            <strong>Fixture</strong>
            <select
              aria-label="Fixture"
              value={state.fixture}
              onChange={(event) => update('fixture', event.target.value)}
            >
              {manifest.fixtures.map((fixture) => (
                <option key={fixture.id} value={fixture.id}>
                  {fixture.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {manifest.configurations.map((configuration) => (
          <div className="lab-harness-control" key={configuration.key}>
            <strong>{configuration.label}</strong>
            <div className="lab-harness-segmented">
              {configuration.options.map((option) => (
                <button
                  key={option.value}
                  aria-label={`${configuration.label} ${option.label}`}
                  aria-pressed={state.configuration[configuration.key] === option.value}
                  onClick={() => update(configuration.key, option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="lab-harness-actions">
          <button
            onClick={() => {
              clearReviewSessionDefinition(
                labReviewSessionIdentity(manifest.baselineId, manifest.id, state.fixture),
              );
              previewRef.current?.contentWindow?.location.reload();
              setCopied(false);
            }}
          >
            Reset
          </button>
          <button
            onClick={() =>
              void navigator.clipboard.writeText(reviewUrl).then(() => setCopied(true))
            }
          >
            {copied ? 'Link copied' : 'Copy review link'}
          </button>
          <a href={previewUrl} target="_blank" rel="noreferrer">
            Open 1:1
          </a>
        </div>
      </section>
      <details className="lab-harness-context">
        <summary>Baseline and evidence</summary>
        <div>
          <section>
            <h2>Inherited baseline</h2>
            <ul>
              {currentAuthoringBaseline.inherited.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Under test</h2>
            <ul>
              {manifest.experimentalAxes.map((axis) => (
                <li key={axis}>{axis}</li>
              ))}
            </ul>
            <p>{manifest.hypothesis}</p>
          </section>
        </div>
      </details>
      <section className="lab-harness-preview-section" aria-label="Preview frame">
        <header>
          <div>
            <span className="lab-harness-device-icon" aria-hidden="true">
              {state.device === 'phone' ? '▯' : '▭'}
            </span>
            <strong>{profile.label} screen</strong>
          </div>
          <small>
            {profile.width} × {profile.height} · scaled to {Math.round(scale * 100)}%
          </small>
        </header>
        <div
          ref={stageRef}
          className="lab-harness-stage"
          style={{ height: profile.height * scale + 24 }}
        >
          <iframe
            ref={previewRef}
            key={previewUrl}
            title={`${manifest.title} ${profile.label} preview`}
            src={previewUrl}
            width={profile.width}
            height={profile.height}
            style={{ transform: `scale(${scale})` }}
          />
        </div>
      </section>
    </main>
  );
}
