import { stopRuntime } from './runtime.js';

export default async function globalTeardown() {
  try {
    await stopRuntime(globalThis.__P11_E2E_RUNTIME);
  } finally {
    delete process.env.P11_E2E_MAIL_ENCRYPTION_KEY;
  }
}
