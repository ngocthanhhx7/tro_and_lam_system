import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createApp } from './app.js';
import { createDomainComposition } from './composition.js';

let databaseConnected = false;
try {
  await connectDatabase(env.mongoUri);
  databaseConnected = true;
  const composition = await createDomainComposition(env);
  const server = createApp({ ...env, domainRouters: composition.domainRouters }).listen(env.port, '0.0.0.0', () => {
    console.log(`TRO & LAM API listening on port ${env.port}`);
    if (env.backgroundWorkersEnabled) void composition.startWorkers();
  });
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const timeout = setTimeout(() => process.exit(1), 30000);
    timeout.unref();
    server.close(async () => {
      try {
        await composition.stopWorkers();
        await disconnectDatabase();
        clearTimeout(timeout);
        process.exit(0);
      }
      catch { process.exit(1); }
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  server.on('error', async () => {
    console.error('Không thể khởi động HTTP server');
    try { await composition.stopWorkers(); } catch { /* Continue closing the database. */ }
    await disconnectDatabase();
    process.exit(1);
  });
} catch {
  console.error('Không thể khởi động backend. Kiểm tra cấu hình máy chủ và kết nối MongoDB.');
  if (databaseConnected) await disconnectDatabase().catch(() => {});
  process.exitCode = 1;
}
