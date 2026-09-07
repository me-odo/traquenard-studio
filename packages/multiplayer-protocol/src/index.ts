import { z } from 'zod';

export const ClientCommandSchema = z.discriminatedUnion('kind', [
  z
    .object({
      protocolVersion: z.literal(1),
      commandId: z.string().min(1),
      kind: z.literal('input.submit'),
      operationId: z.string().min(1),
      choice: z.string(),
    })
    .strict(),
]);

export type ClientCommand = z.infer<typeof ClientCommandSchema>;

export const CreateSessionSchema = z.object({
  artifactId: z.string().min(1),
  hostName: z.string().min(1).max(60),
  seed: z.number().int().optional(),
});
export const JoinSessionSchema = z.object({ name: z.string().min(1).max(60) });
