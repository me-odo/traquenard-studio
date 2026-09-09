import {
  authoredCollectionDeclarations,
  authoredStateDeclarations,
  flowOutputDeclarations,
} from '@traquenard/authoring-domain';
import type { GameDefinition } from '@traquenard/game-ir';
import { displayName } from '../document.js';

export function DataLibrary(props: {
  readonly definition: GameDefinition;
  readonly onRuntime: () => void;
  readonly onResource: (id: string) => void;
  readonly onCreate: (kind: 'collection' | 'state' | 'string' | 'boolean') => void;
}) {
  const collections = authoredCollectionDeclarations(props.definition);
  const states = authoredStateDeclarations(props.definition);
  const outputs = flowOutputDeclarations(props.definition);
  return (
    <section>
      <h3>Data</h3>
      <strong className="authoring-ui-tree-label">Runtime</strong>
      <button className="authoring-ui-tree-item" onClick={props.onRuntime}>
        Players <small>Session-provided · read-only</small>
      </button>
      <strong className="authoring-ui-tree-label">Collections</strong>
      {collections.map((item) => (
        <button
          key={item.name}
          className="authoring-ui-tree-item"
          onClick={() => props.onResource(item.name)}
        >
          {displayName(item.name)} <small>Authored collection</small>
        </button>
      ))}
      <button className="authoring-ui-create" onClick={() => props.onCreate('collection')}>
        + New collection
      </button>
      <strong className="authoring-ui-tree-label">State</strong>
      {states.map((item) => (
        <button
          key={item.name}
          className="authoring-ui-tree-item"
          onClick={() => props.onResource(item.name)}
        >
          {displayName(item.name)} <small>Authored {displayName(item.type.kind)}</small>
        </button>
      ))}
      <button className="authoring-ui-create" onClick={() => props.onCreate('state')}>
        + New number
      </button>
      <button className="authoring-ui-create" onClick={() => props.onCreate('string')}>
        + New text
      </button>
      <button className="authoring-ui-create" onClick={() => props.onCreate('boolean')}>
        + New true / false
      </button>
      <strong className="authoring-ui-tree-label">Flow-produced values</strong>
      {outputs.map((item) => (
        <span key={item.name} className="authoring-ui-tree-static">
          {displayName(item.name)}{' '}
          <small>{displayName(item.type.kind)} · available by flow position</small>
        </span>
      ))}
    </section>
  );
}
