import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createDomainComposition } from './composition.js';

let databaseConnected = false;
let stopping = false;
try {
  await connectDatabase(env.mongoUri);
  databaseConnected = true;
  const composition = await createDomainComposition(env);
  const stopSignal = new Promise((resolve) => {
    process.once('SIGTERM', () => resolve('SIGTERM'));
    process.once('SIGINT', () => resolve('SIGINT'));
  });
  await composition.startWorkers();
  console.log('TRO & LAM background workers started');
  await stopSignal;
  stopping = true;
  await composition.stopWorkers();
  await disconnectDatabase();
} catch {
  console.error('Không thể khởi động hoặc dừng worker. Kiểm tra cấu hình máy chủ và kết nối MongoDB.');
  if (databaseConnected && !stopping) await disconnectDatabase().catch(() => {});
  process.exitCode = 1;
}
