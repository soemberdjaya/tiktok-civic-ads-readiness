// pnpm eval --provider deepseek [--model deepseek-chat]
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const get = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const env = { ...process.env, EVAL_PROVIDER: get('provider') ?? 'deepseek', EVAL_MODEL: get('model') ?? '', EVAL_ONLY: get('only') ?? '' };
const r = spawnSync('pnpm', ['exec', 'vitest', 'run'], {
  stdio: 'inherit',
  env,
});
process.exit(r.status ?? 1);
