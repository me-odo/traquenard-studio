import { z } from 'zod';

export const ClientCommandSchema = z.discriminatedUnion('kind', [
  z.object({
    protocolVersion: z.literal(1),
    commandId: z.string().min(1),
    kind: z.literal('input.submit'),
    participantId: z.string().min(1),
    operationId: z.string().min(1),
    choice: z.string(),
  }),
  z.object({
    protocolVersion: z.literal(1),
    commandId: z.string().min(1),
    kind: z.literal('time.advance'),
    milliseconds: z.number().int().nonnegative(),
  }),
  z.object({
    protocolVersion: z.literal(1),
    commandId: z.string().min(1),
    kind: z.literal('participant.disconnected'),
    participantId: z.string().min(1),
  }),
  z.object({
    protocolVersion: z.literal(1),
    commandId: z.string().min(1),
    kind: z.literal('participant.reconnected'),
    participantId: z.string().min(1),
  }),
]);

export type ClientCommand = z.infer<typeof ClientCommandSchema>;

export const CreateSessionSchema = z.object({
  artifactId: z.string().min(1),
  hostName: z.string().min(1).max(60),
  seed: z.number().int().optional(),
});
export const JoinSessionSchema = z.object({ name: z.string().min(1).max(60) });
