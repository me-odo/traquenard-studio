import {
  applyCommand,
  createSession,
  type Participant,
  type SessionState,
} from '@traquenard/engine-runtime';
import type { GameArtifact } from '@traquenard/game-ir';
export * from './reference-games.js';

export interface SimulationResult {
  readonly session: SessionState;
  readonly trace: readonly string[];
}

export function simulateGame(artifact: GameArtifact, seed = 42): SimulationResult {
  const participants: readonly Participant[] = [
    { id: 'p1', name: 'Host', isHost: true, required: true },
    { id: 'p2', name: 'Alex', isHost: false, required: true },
    { id: 'p3', name: 'Sam', isHost: false, required: true },
  ];
  let session = createSession({
    sessionId: 'simulation',
    joinCode: 'SIM123',
    artifact,
    participants,
    seed,
  });
  const trace: string[] = [];
  let command = 0;
  while (session.status !== 'completed' && command < 100) {
    const waits = Object.values(session.engine.pending);
    if (waits.length === 0)
      throw new Error(`Simulation stuck with ${session.engine.frames.length} remaining frame(s).`);
    for (const wait of waits) {
      if (wait.kind === 'input') {
        session = applyCommand(session, {
          protocolVersion: 1,
          commandId: `sim-${++command}`,
          kind: 'input.submit',
          participantId: wait.participantId,
          operationId: wait.operationId,
          choice: wait.options[0]!,
        });
        trace.push(`choice:${wait.operationId}:${wait.options[0]}`);
      }
    }
    const timers = Object.values(session.engine.pending).filter((wait) => wait.kind === 'timer');
    if (timers.length > 0) {
      const delta = Math.max(...timers.map((timer) => timer.dueAt - session.engine.logicalTime));
      session = applyCommand(session, {
        protocolVersion: 1,
        commandId: `sim-${++command}`,
        kind: 'time.advance',
        milliseconds: delta,
      });
      trace.push(`time:+${delta}`);
    }
  }
  if (session.status !== 'completed') throw new Error('Simulation exceeded its command limit.');
  return { session, trace };
}

export class FakeLogicalClock {
  public constructor(public session: SessionState) {}
  public advance(milliseconds: number): SessionState {
    this.session = applyCommand(this.session, {
      protocolVersion: 1,
      commandId: `clock-${this.session.commandHistory.length + 1}`,
      kind: 'time.advance',
      milliseconds,
    });
    return this.session;
  }
}
