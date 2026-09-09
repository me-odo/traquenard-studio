import { Combobox } from '@base-ui/react/combobox';
import { useDraggable } from '@dnd-kit/react';
import type { InsertableOperationKind } from '../registry/operations.js';
import { operationCatalog } from '../registry/operations.js';

export function BlockLibrary(props: {
  readonly onInsert: (kind: InsertableOperationKind) => void;
}) {
  return (
    <section>
      <h3>Blocks</h3>
      <div className="authoring-ui-palette">
        {operationCatalog.map((item) => (
          <PaletteBlock
            key={item.kind}
            kind={item.kind as InsertableOperationKind}
            label={item.label}
            onInsert={props.onInsert}
          />
        ))}
      </div>
      <SearchableAdd onChoose={props.onInsert} />
      <p className="authoring-ui-note">
        Drag is an accelerator. Tap, click, search, and keyboard insertion remain available.
      </p>
    </section>
  );
}

export function SearchableAdd(props: {
  readonly onChoose: (kind: InsertableOperationKind) => void;
  readonly autoFocus?: boolean;
}) {
  const labels = operationCatalog.map((item) => item.label);
  return (
    <div className="authoring-ui-search-add">
      <Combobox.Root
        items={labels}
        onValueChange={(label) => {
          const item = operationCatalog.find((candidate) => candidate.label === label);
          if (item) props.onChoose(item.kind as InsertableOperationKind);
        }}
      >
        <label htmlFor={props.autoFocus ? 'dialog-add-search' : 'library-add-search'}>
          Search blocks
        </label>
        <Combobox.InputGroup>
          <Combobox.Input
            autoFocus={props.autoFocus}
            id={props.autoFocus ? 'dialog-add-search' : 'library-add-search'}
            placeholder="Show message, If, Draw item…"
          />
          <Combobox.Trigger aria-label="Open block choices">⌄</Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={6} className="authoring-ui-combobox-positioner">
            <Combobox.Popup className="authoring-ui-combobox-popup">
              <Combobox.Empty>No matching blocks</Combobox.Empty>
              <Combobox.List>
                {labels.map((label) => (
                  <Combobox.Item key={label} value={label}>
                    {label}
                  </Combobox.Item>
                ))}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}

function PaletteBlock(props: {
  readonly kind: InsertableOperationKind;
  readonly label: string;
  readonly onInsert: (kind: InsertableOperationKind) => void;
}) {
  const { ref, isDragging } = useDraggable({ id: `palette:${props.kind}` });
  return (
    <button
      ref={ref}
      className={`authoring-ui-palette-block ${isDragging ? 'is-dragging' : ''}`}
      onClick={() => props.onInsert(props.kind)}
      data-palette-kind={props.kind}
    >
      <span aria-hidden="true">⠿</span>
      <strong>{props.label}</strong>
    </button>
  );
}
