import { buildServer } from './index.js';

const app = await buildServer();
await app.listen({ port: Number(process.env.PORT ?? 3000), host: '127.0.0.1' });
