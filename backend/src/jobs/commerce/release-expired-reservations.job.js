export function createReleaseExpiredReservationsJob({ commerceService, logger = console } = {}) {
  if (typeof commerceService?.releaseExpiredReservations !== 'function') {
    throw new TypeError('Commerce service thiếu releaseExpiredReservations');
  }
  return async function releaseExpiredReservationsJob({ batchSize = 100 } = {}) {
    const result = await commerceService.releaseExpiredReservations({ batchSize });
    if (result.reason) logger.warn?.('Commerce expiry job deferred: no verified payment expiry adapter');
    else if (result.checked > 0) logger.info?.(`Commerce expiry job: checked=${result.checked} released=${result.released} deferred=${result.deferred}`);
    return result;
  };
}
