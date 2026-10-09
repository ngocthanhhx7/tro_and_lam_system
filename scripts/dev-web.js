import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function resolveDevProxyTarget(source = process.env, backendEnv = '') {
  if (source.API_PROXY_TARGET) return source.API_PROXY_TARGET;
  const port = Number(source.PORT || parseEnv(backendEnv).PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT phải nằm trong 1–65535');
  return `http://127.0.0.1:${port}`;
}

export async function waitForApi(target, { timeoutMs = 30_000, retryMs = 250, signal } = {}) {
  const healthUrl = new URL('/api/v1/health/ready', target);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const attemptTimeout = AbortSignal.timeout(Math.max(1, Math.min(2000, deadline - Date.now())));
    try {
      const response = await fetch(healthUrl, { signal: signal ? AbortSignal.any([signal, attemptTimeout]) : attemptTimeout });
      await response.body?.cancel();
      if (response.status === 200) return;
    } catch {
      signal?.throwIfAborted();
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await delay(Math.min(retryMs, remaining), undefined, { signal });
  }
  throw new Error('API chưa sẵn sàng sau 30 giây. Kiểm tra log [api], MONGODB_URI và PORT trong backend/.env.');
}

export async function launchDevWeb({ proxyTarget, env = process.env, spawnImpl = spawn, ...readinessOptions }) {
  await waitForApi(proxyTarget, readinessOptions);
  return spawnImpl(process.execPath, [resolve(repositoryRoot, 'node_modules/vite/bin/vite.js')], {
    cwd: resolve(repositoryRoot, 'fondend'),
    env: { ...env, API_PROXY_TARGET: proxyTarget },
    stdio: 'inherit',
    windowsHide: true,
  });
}

async function main() {
  const controller = new AbortController();
  let web;
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => { controller.abort(); web?.kill(signal); });
  }
  try {
    const backendEnv = await readFile(resolve(repositoryRoot, 'backend/.env'), 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return '';
      throw error;
    });
    const proxyTarget = resolveDevProxyTarget(process.env, backendEnv);
    console.log('Đang chờ API sẵn sàng trước khi mở frontend…');
    web = await launchDevWeb({ proxyTarget, signal: controller.signal });
    web.once('error', () => { console.error('Không thể khởi động frontend.'); process.exitCode = 1; });
    web.once('exit', (code) => { process.exitCode = controller.signal.aborted ? 0 : (code ?? 1); });
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
