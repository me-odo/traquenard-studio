import { buildServer } from './index.js';

const testSemanticSeed =
  process.env.NODE_ENV === 'test' ? process.env.TRAQUENARD_TEST_SEMANTIC_SEED : undefined;
const app = await buildServer(
  testSemanticSeed ? { semanticSeedFactory: () => testSemanticSeed } : undefined,
);
await app.listen({ port: Number(process.env.PORT ?? 3000), host: '127.0.0.1' });
