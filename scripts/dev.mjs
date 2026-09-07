import { spawn } from 'node:child_process';

const commands = [
  ['pnpm', ['--filter', '@traquenard/server', 'dev']],
  ['pnpm', ['--filter', '@traquenard/web', 'dev']],
];
const children = commands.map(([command, args]) =>
  spawn(command, args, { stdio: 'inherit', env: process.env }),
);

const stop = () => {
  for (const child of children) child.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
await Promise.race(children.map((child) => new Promise((resolve) => child.on('exit', resolve))));
stop();
