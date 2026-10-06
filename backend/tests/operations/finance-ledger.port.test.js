import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinanceLedgerPort } from '../../src/services/operations/finance-ledger.port.js';

function aggregateModel(total, pipelines = []) {
  return {
    aggregate(pipeline) {
      pipelines.push(pipeline);
      return Promise.resolve(total === null ? [] : [{ totalVnd: total }]);
    },
  };
}

test('finance ledger totals applied PayOS, recorded COD, and completed refunds by their event timestamps', async () => {
  const pipelines = [];
  const from = new Date('2026-10-01T00:00:00.000Z');
  const to = new Date('2026-10-31T16:59:59.999Z');
  const port = createFinanceLedgerPort({
    PaymentEvent: aggregateModel(240_000, pipelines),
    CodCollection: aggregateModel(120_000, pipelines),
    Refund: aggregateModel(30_000, pipelines),
  });

  assert.deepEqual(await port.getStatistics({ from, to, timezone: 'Asia/Ho_Chi_Minh' }), {
    grossCollectedVnd: 360_000,
    refundedVnd: 30_000,
  });
  assert.deepEqual(pipelines.map(([stage]) => stage.$match), [
    { processingState: 'applied', verifiedAt: { $gte: from, $lte: to } },
    { recordedAt: { $gte: from, $lte: to } },
    { status: 'completed', updatedAt: { $gte: from, $lte: to } },
  ]);
});

test('finance ledger returns zero totals when no ledger events match', async () => {
  const port = createFinanceLedgerPort({
    PaymentEvent: aggregateModel(null),
    CodCollection: aggregateModel(null),
    Refund: aggregateModel(null),
  });

  assert.deepEqual(await port.getStatistics({
    from: new Date('2026-10-01T00:00:00.000Z'),
    to: new Date('2026-10-31T16:59:59.999Z'),
  }), { grossCollectedVnd: 0, refundedVnd: 0 });
});
