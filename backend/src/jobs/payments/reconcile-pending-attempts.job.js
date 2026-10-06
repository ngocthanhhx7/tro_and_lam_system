/** A bounded job factory. The process scheduler belongs to the application host. */
export function createReconcilePendingAttemptsJob({ paymentsService, batchSize = 100 } = {}) {
  if (!paymentsService || typeof paymentsService.reconcilePendingAttempts !== 'function') {
    throw new TypeError('P06 job cần paymentsService.reconcilePendingAttempts');
  }
  const boundedBatchSize = Number.isSafeInteger(batchSize) ? Math.min(500, Math.max(1, batchSize)) : 100;
  return function reconcilePendingAttempts() {
    return paymentsService.reconcilePendingAttempts({ batchSize: boundedBatchSize });
  };
}
