import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createApp } from './app.js';

try {
  await connectDatabase(env.mongoUri);
  const server = createApp(env).listen(env.port, '0.0.0.0', () => console.log(`TRO & LAM API listening on port ${env.port}`));
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      try { await disconnectDatabase(); clearTimeout(timeout); process.exit(0); }
      catch { process.exit(1); }
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  server.on('error', async () => { console.error('Không thể khởi động HTTP server'); await disconnectDatabase(); process.exit(1); });
} catch {
  console.error('Không thể kết nối MongoDB. Kiểm tra URI, database user và IP access list.');
  process.exitCode = 1;
}
