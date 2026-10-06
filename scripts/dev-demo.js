import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const concurrentlyCli = resolve(repositoryRoot, 'node_modules/concurrently/dist/bin/concurrently.js');
const demoMongoUri = 'mongodb://127.0.0.1:27017/tro_lam_dev_catalog_demo';
const demoApiPort = process.env.PORT || '5000';

const processes = spawn(process.execPath, [
  concurrentlyCli,
  '-k',
  '-n',
  'web,api',
  'npm run dev -w fondend',
  'npm run dev -w backend',
], {
  cwd: repositoryRoot,
  env: {
    ...process.env,
    MONGODB_URI: demoMongoUri,
    PORT: demoApiPort,
    API_PROXY_TARGET: `http://localhost:${demoApiPort}`,
  },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => processes.kill(signal));
}

processes.once('error', (error) => {
  process.stderr.write(`Could not start the demo development servers: ${error.message}\n`);
  process.exitCode = 1;
});

processes.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
