import { stopRuntime } from './runtime.js';

export default async function globalTeardown() {
  await stopRuntime(globalThis.__P11_E2E_RUNTIME);
}
