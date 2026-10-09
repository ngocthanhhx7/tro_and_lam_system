import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { resolveDevProxyTarget, launchDevWeb, waitForApi } from '../../scripts/dev-web.js';

async function healthServer(t, handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('development proxy follows backend port and preserves explicit overrides', () => {
  assert.equal(resolveDevProxyTarget({}, 'PORT=5017\nSECRET=never-forward-this'), 'http://127.0.0.1:5017');
  assert.equal(resolveDevProxyTarget({ PORT: '5018' }, 'PORT=5017'), 'http://127.0.0.1:5018');
  assert.equal(resolveDevProxyTarget({ API_PROXY_TARGET: 'http://127.0.0.1:5020' }, 'PORT=5017'), 'http://127.0.0.1:5020');
});

test('frontend is launched only after backend readiness, including a temporary 503', async (t) => {
  let attempts = 0;
  let ready = false;
  const target = await healthServer(t, (req, res) => {
    assert.equal(req.url, '/api/v1/health/ready');
    attempts += 1;
    ready = attempts > 1;
    res.writeHead(ready ? 200 : 503).end();
  });
  let launches = 0;
  const child = await launchDevWeb({ proxyTarget: target, env: { FRONTEND_PORT: '5180' }, retryMs: 5, timeoutMs: 1000,
    spawnImpl: (_command, args, options) => {
      launches += 1;
      assert.equal(ready, true);
      assert.equal(options.env.API_PROXY_TARGET, target);
      assert.equal(options.env.FRONTEND_PORT, '5180');
      assert.ok(args[0].endsWith('vite.js'));
      return 'test-child';
    },
  });
  assert.equal(child, 'test-child');
  assert.equal(launches, 1);
  assert.equal(attempts, 2);
});

test('unavailable API times out without starting frontend', async (t) => {
  const target = await healthServer(t, (_req, res) => res.writeHead(503).end());
  let launched = false;
  await assert.rejects(launchDevWeb({ proxyTarget: target, timeoutMs: 40, retryMs: 5,
    spawnImpl: () => { launched = true; },
  }), /API chưa sẵn sàng/u);
  assert.equal(launched, false);
});

test('cancelled startup stops waiting for backend', async (t) => {
  const controller = new AbortController();
  const target = await healthServer(t, (_req, res) => { res.writeHead(503).end(); controller.abort(); });
  await assert.rejects(waitForApi(target, { signal: controller.signal, retryMs: 5, timeoutMs: 1000 }), { name: 'AbortError' });
});
