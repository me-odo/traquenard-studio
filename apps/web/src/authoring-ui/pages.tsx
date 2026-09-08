import { authoringCanonicalDefinition } from '../authoring-lab-model.js';
import { fixtureByKey, type ParallelFixtureKey } from '../parallel-lab-model.js';
import { referenceFixtures, type ReferenceFixtureKey } from '../reference-lab-model.js';
import { AuthoringEditor } from './editor.js';
import { createLongBaselineDocument } from './document.js';
import { LabHarness } from './lab-harness.js';
import { rootAuthoringSurface } from './contracts.js';
import { activeLabRegistry, labManifest, normalizedLabState } from './registry.js';

export function CurrentAuthoringPage() {
  return (
    <AuthoringEditor
      initialDefinition={authoringCanonicalDefinition}
      experimentalAxes={rootAuthoringSurface.experimentalAxes}
    />
  );
}

export function VisualLabIndex() {
  return (
    <main className="visual-lab-index">
      <header>
        <div>
          <span className="lab-harness-eyebrow">EXPERIMENT INDEX</span>
          <h1>Visual Lab</h1>
          <p>
            Every active experiment inherits the current editor baseline and declares only the axis
            under test.
          </p>
        </div>
        <a href="/">Current editor</a>
      </header>
      <section aria-label="Registered authoring experiments">
        {activeLabRegistry.map((manifest) => (
          <a
            key={manifest.id}
            href={manifest.route}
            className={`visual-lab-card status-${manifest.status}`}
          >
            <span>
              ISSUE #{manifest.issue} · {manifest.status.toUpperCase()}
            </span>
            <strong>{manifest.title}</strong>
            <small>Under test: {manifest.experimentalAxes.join(' + ')}</small>
          </a>
        ))}
      </section>
      <p className="visual-lab-history">
        Issue #7’s framework comparison is retired. Its adopted custom renderer, dnd-kit, and Base
        UI direction now lives in the shared baseline.
      </p>
    </main>
  );
}

export function RegisteredLabPage({ id }: { readonly id: string }) {
  const manifest = labManifest(id);
  return manifest ? <LabHarness manifest={manifest} /> : <CurrentAuthoringPage />;
}

export function LabPreviewPage({ id }: { readonly id: string }) {
  const manifest = labManifest(id);
  if (!manifest) return <CurrentAuthoringPage />;
  const state = normalizedLabState(manifest, new URLSearchParams(window.location.search));
  const initialDefinition = definitionFor(id, state.fixture);
  const overrides =
    id === 'authoring'
      ? { containment: state.configuration.containment as 'c-shape' | 'framed' }
      : id === 'parallel'
        ? {
            parallelProjection: state.configuration.projection as 'grouped' | 'lanes' | 'fork-join',
          }
        : {
            semanticNavigation: state.configuration.navigation === 'on',
            traceOverlay: state.configuration.traces === 'on',
          };
  return (
    <AuthoringEditor
      initialDefinition={initialDefinition}
      surfaceLabel={`${manifest.title} baseline preview`}
      experimentalAxes={manifest.experimentalAxes}
      overrides={overrides}
    />
  );
}

function definitionFor(id: string, fixture: string) {
  if (id === 'authoring')
    return fixture === 'long-flow' ? createLongBaselineDocument() : authoringCanonicalDefinition;
  if (id === 'parallel') return fixtureByKey(fixture as ParallelFixtureKey).definition;
  return (
    referenceFixtures.find((item) => item.key === (fixture as ReferenceFixtureKey))?.definition ??
    referenceFixtures[0]!.definition
  );
}
