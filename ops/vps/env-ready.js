// systemd ExecCondition: skip startup while the owner configures Atlas.
// Only configuration field errors are emitted; never print environment values.
try {
  await import('../../backend/src/config/env.js');
} catch {
  console.error('Backend configuration is incomplete. Edit /opt/tro-lam/current/backend/.env, then restart tro-lam-api.');
  process.exitCode = 1;
}
