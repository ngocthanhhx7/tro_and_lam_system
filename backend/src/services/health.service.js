export function getReadiness(databaseReady) {
  return { status: databaseReady ? 'ready' : 'unavailable', database: databaseReady ? 'connected' : 'disconnected' };
}
