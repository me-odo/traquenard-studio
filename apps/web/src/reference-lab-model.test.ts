import { describe, expect, it } from 'vitest';
import { validateDefinition } from '@traquenard/game-validator';
import {
  backReferenceNavigation,
  candidatesForInput,
  canonicalFixtureJson,
  consumersOfReference,
  enterComposite,
  initialReferenceNavigation,
  navigateToReferenceSource,
  outlineForFixture,
  projectFixture,
  referenceFixtureByKey,
  referenceFixtures,
  sourceForReference,
} from './reference-lab-model.js';

describe('references lab semantic fixtures', () => {
  it('keeps every canonical fixture valid', () => {
    for (const fixture of referenceFixtures) {
      expect(validateDefinition(fixture.definition), fixture.key).toEqual({
        valid: true,
        issues: [],
      });
    }
  });

  it('derives visual and outline projections from the same fixture', () => {
    const fixture = referenceFixtureByKey('drawn-card');
    const visual = projectFixture(fixture);
    const outline = outlineForFixture(fixture).join('\n');
    expect(visual.map((node) => node.label)).toContain('Carry Drawn Card');
    expect(outline).toContain('Carry Drawn Card');
    expect(outline).toContain('Drawn Card : card');
  });

  it('offers two identifiable deck references and explains the incompatible player', () => {
    const fixture = referenceFixtureByKey('incompatible');
    const node = projectFixture(fixture).find((item) => item.id === 'draw-question')!;
    const input = node.inputs[0]!;
    const candidates = candidatesForInput(fixture, node, input);
    expect(
      candidates.filter((candidate) => candidate.compatible).map((item) => item.value.id),
    ).toEqual(['questionsDeck', 'challengesDeck']);
    expect(candidates.find((candidate) => candidate.value.id === 'currentPlayer')).toMatchObject({
      compatible: false,
      reason: 'Expected Collection<card>, received participant.',
    });
  });

  it('traces a distant value to its producer and all expected consumers', () => {
    const fixture = referenceFixtureByKey('current-player');
    expect(sourceForReference(fixture, 'currentPlayer')?.sourceNodeId).toBe('choose-player');
    expect(consumersOfReference(fixture, 'currentPlayer').map((node) => node.id)).toEqual([
      'ask-current-player',
      'private-current-player',
    ]);
  });

  it('preserves parent context across Composite focus and source navigation', () => {
    const fixture = referenceFixtureByKey('composite');
    const entered = enterComposite(initialReferenceNavigation(), 'turn.prepare', 'prepare-turn');
    const deckInput = sourceForReference(fixture, 'deck', 'turn.prepare')!;
    const atSource = navigateToReferenceSource(fixture, entered, deckInput);
    expect(atSource).toMatchObject({ context: 'parent', focusedNodeId: 'game-values' });
    const returnedToComposite = backReferenceNavigation(atSource);
    expect(returnedToComposite).toMatchObject({
      context: 'composite',
      compositeId: 'turn.prepare',
    });
    const returnedToParent = backReferenceNavigation(returnedToComposite);
    expect(returnedToParent).toMatchObject({ context: 'parent', focusedNodeId: 'prepare-turn' });
  });

  it('keeps canonical IR unchanged while candidates are inspected and selected in projection state', () => {
    const fixture = referenceFixtureByKey('two-decks');
    const before = canonicalFixtureJson(fixture);
    const node = projectFixture(fixture)[0]!;
    const candidates = candidatesForInput(fixture, node, node.inputs[0]!);
    const challengeDeck = candidates.find((candidate) => candidate.value.id === 'challengesDeck')!;
    const projectionSelection = { [`${node.id}:from`]: challengeDeck.value.id };
    expect(projectionSelection).toEqual({ 'draw-question:from': 'challengesDeck' });
    expect(canonicalFixtureJson(fixture)).toBe(before);
  });
});
