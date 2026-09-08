import { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import type { GameDefinition } from '@traquenard/game-ir';
import { findOperation, operationLabel } from './authoring-lab-model.js';
import {
  applySemanticCommand,
  blocklyMoveCommand,
  createFrameworkSpikeDocument,
  operationSummary,
  projectFixtureToBlockly,
  semanticOrder,
} from './framework-spike-model.js';

const toolbox: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'flyoutToolbox',
  contents: [
    { kind: 'block', type: 'traq_present' },
    { kind: 'block', type: 'traq_time_wait' },
    { kind: 'block', type: 'traq_control_if' },
    { kind: 'block', type: 'traq_control_foreach' },
    { kind: 'block', type: 'traq_participant_ref' },
  ],
};

export default function BlocklySpike() {
  const host = useRef<HTMLDivElement>(null);
  const workspace = useRef<Blockly.WorkspaceSvg | undefined>(undefined);
  const [definition, setDefinition] = useState<GameDefinition>(() =>
    createFrameworkSpikeDocument(),
  );
  const [selectedId, setSelectedId] = useState('each-player');
  const [lastCommand, setLastCommand] = useState('Projection loaded; no adapter command yet.');
  const selected = findOperation(definition, selectedId);

  useEffect(() => {
    registerTraquenardBlocks();
    if (!host.current) return;
    const blocklyWorkspace = Blockly.inject(host.current, {
      toolbox,
      renderer: 'zelos',
      trashcan: true,
      move: { drag: true, scrollbars: true },
      zoom: { controls: true, wheel: true, pinch: true, minScale: 0.45, maxScale: 1.4 },
    });
    workspace.current = blocklyWorkspace;
    Blockly.serialization.workspaces.load(
      projectFixtureToBlockly(createFrameworkSpikeDocument()),
      blocklyWorkspace,
    );
    blocklyWorkspace.cleanUp();
    const listener = (event: Blockly.Events.Abstract) => {
      if (!(event instanceof Blockly.Events.Click)) return;
      const blockId = event.blockId ?? '';
      if (blockId && !blockId.includes(':')) setSelectedId(blockId);
    };
    blocklyWorkspace.addChangeListener(listener);
    return () => {
      blocklyWorkspace.removeChangeListener(listener);
      blocklyWorkspace.dispose();
      workspace.current = undefined;
    };
  }, []);

  const applyProofMove = () => {
    const current = workspace.current;
    if (!current) return;
    const wait = current.getBlockById('wait-again');
    const foreach = current.getBlockById('each-player');
    const body = foreach?.getInput('BODY')?.connection?.targetBlock();
    if (!wait?.previousConnection || !body?.nextConnection) return;
    wait.unplug(true);
    body.nextConnection.connect(wait.previousConnection);
    const command = blocklyMoveCommand('wait-again', 'each-player', 'BODY', 1);
    setDefinition((document) => applySemanticCommand(document, command));
    setSelectedId('wait-again');
    setLastCommand('move wait-again → each-player-body[1]');
    Blockly.svgResize(current);
  };

  return (
    <section className="blockly-spike-shell" aria-label="Blockly authoring projection proof">
      <aside className="blockly-external-library" aria-label="External game document navigation">
        <h2>Library</h2>
        <section>
          <h3>Blocks</h3>
          <p>Blockly toolbox controls active-flow block insertion.</p>
        </section>
        <section>
          <h3>Data</h3>
          <p>Runtime / Players</p>
          <p>Collections / Questions</p>
          <p>State / Score</p>
        </section>
        <section>
          <h3>Workflows</h3>
          <button>Main</button>
          <button>Prepare Turn</button>
        </section>
        <p className="framework-note">Resources and named Workflows stay outside Blockly.</p>
      </aside>
      <section className="blockly-surface" aria-label="Blockly structured workflow surface">
        <header>
          <div>
            <span className="eyebrow">SAME TRAQUENARD FIXTURE</span>
            <h2>Main workflow</h2>
          </div>
          <button onClick={applyProofMove}>Move Else Wait into For Each via adapter</button>
        </header>
        <div ref={host} className="blockly-host" data-testid="blockly-workspace" />
        <output className="semantic-order" aria-live="polite">
          <strong>Traquenard semantic command log</strong>
          <span>{lastCommand}</span>
          <small>For Each body: {semanticOrder(definition, 'each-player-body').join(' → ')}</small>
          <small>Else body: {semanticOrder(definition, 'answer-no').join(' → ') || 'empty'}</small>
        </output>
      </section>
      <aside
        className="blockly-external-inspector"
        aria-label="External Blockly selection inspector"
      >
        <h2>Inspector</h2>
        {selected ? (
          <>
            <span className="eyebrow">SEMANTIC OBJECT</span>
            <h3>{operationLabel(selected)}</h3>
            <p>{operationSummary(selected)}</p>
            <code>{selected.id}</code>
          </>
        ) : (
          <p>Select a block.</p>
        )}
        <p className="framework-note">
          Inspector edits would issue Traquenard commands; Blockly fields are projection controls,
          not canonical state.
        </p>
      </aside>
    </section>
  );
}

function registerTraquenardBlocks() {
  if (Blockly.Blocks['traq_control_foreach']) return;
  Blockly.common.defineBlocksWithJsonArray([
    statement('traq_random_select', 'choose Player from Players', 205),
    {
      ...statement('traq_collection_draw', 'draw from %1 → Current Card', 24),
      args0: [
        {
          type: 'field_dropdown',
          name: 'COLLECTION',
          options: [
            ['Questions', 'questionsDeck'],
            ['Challenges', 'challengesDeck'],
          ],
        },
      ],
    },
    {
      type: 'traq_input_wait',
      message0: 'ask %1',
      args0: [{ type: 'field_input', name: 'PROMPT', text: 'Ready?' }],
      message1: 'participant %1',
      args1: [{ type: 'input_value', name: 'PARTICIPANT', check: 'Participant' }],
      previousStatement: null,
      nextStatement: null,
      colour: 310,
    },
    statement('traq_present', 'present message', 165),
    {
      ...statement('traq_time_wait', 'wait %1 seconds', 60),
      args0: [{ type: 'field_number', name: 'SECONDS', value: 1, min: 0 }],
    },
    {
      type: 'traq_control_foreach',
      message0: 'for each %1 in %2',
      args0: [
        { type: 'field_input', name: 'ITEM', text: 'Player' },
        { type: 'field_input', name: 'COLLECTION', text: 'Players' },
      ],
      message1: 'do %1',
      args1: [{ type: 'input_statement', name: 'BODY' }],
      previousStatement: null,
      nextStatement: null,
      colour: 265,
    },
    {
      type: 'traq_control_if',
      message0: 'if %1 %2 %3',
      args0: [
        { type: 'field_input', name: 'LEFT', text: 'Answer' },
        { type: 'field_dropdown', name: 'OPERATOR', options: [['equals', 'equals']] },
        { type: 'field_input', name: 'RIGHT', text: 'Yes' },
      ],
      message1: 'then %1',
      args1: [{ type: 'input_statement', name: 'THEN' }],
      message2: 'else %1',
      args2: [{ type: 'input_statement', name: 'ELSE' }],
      previousStatement: null,
      nextStatement: null,
      colour: 265,
    },
    {
      type: 'traq_control_parallel',
      message0: 'in parallel · wait for all %1',
      args0: [{ type: 'input_statement', name: 'BRANCHES' }],
      previousStatement: null,
      nextStatement: null,
      colour: 265,
    },
    {
      ...statement('traq_composite_invoke', 'run workflow %1', 125),
      args0: [{ type: 'field_input', name: 'WORKFLOW', text: 'Prepare Turn' }],
    },
    statement('traq_end', 'end game', 5),
    {
      type: 'traq_participant_ref',
      message0: 'Current Player',
      output: 'Participant',
      colour: 205,
    },
  ]);
  Blockly.ShortcutItems.registerNavigationShortcuts();
}

function statement(type: string, message0: string, colour: number): Record<string, unknown> {
  return { type, message0, previousStatement: null, nextStatement: null, colour };
}
