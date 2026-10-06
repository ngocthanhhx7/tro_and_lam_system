import { startRuntime } from './runtime.js';

export default async function globalSetup() {
  const runtime = await startRuntime();
  globalThis.__P11_E2E_RUNTIME = runtime;
  process.env.P11_E2E_FIXTURE_PRODUCT_ID = runtime.fixture.publishedProductId;
  process.env.P11_E2E_FIXTURE_DRAFT_ID = runtime.fixture.draftProductId;
}
