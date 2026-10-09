import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinanceLedgerPort } from '../../src/services/operations/finance-ledger.port.js';

function aggregateModel(total, pipelines = [], daily = []) {
  return {
    aggregate(pipeline) {
      pipelines.push(pipeline);
      const groupedByDate = pipeline.some((stage) => stage.$group?._id?.$dateToString);
      if (groupedByDate) return Promise.resolve(daily);
      return Promise.resolve(total === null ? [] : [{ totalVnd: total }]);
    },
  };
}

test('finance ledger totals applied PayOS, recorded COD, and completed refunds by their event timestamps', async () => {
  const pipelines = [];
  const from = new Date('2026-10-01T00:00:00.000Z');
  const to = new Date('2026-10-31T16:59:59.999Z');
  const port = createFinanceLedgerPort({
    PaymentEvent: aggregateModel(240_000, pipelines, [{ _id: '2026-10-01', totalVnd: 100_000 }, { _id: '2026-10-02', totalVnd: 140_000 }]),
    CodCollection: aggregateModel(120_000, pipelines, [{ _id: '2026-10-01', totalVnd: 120_000 }]),
    Refund: aggregateModel(30_000, pipelines, [{ _id: '2026-10-02', totalVnd: 30_000 }]),
  });

  assert.deepEqual(await port.getStatistics({ from, to, timezone: 'Asia/Ho_Chi_Minh' }), {
    grossCollectedVnd: 360_000,
    refundedVnd: 30_000,
    daily: [
      { date: '2026-10-01', grossCollectedVnd: 220_000, refundedVnd: 0 },
      { date: '2026-10-02', grossCollectedVnd: 140_000, refundedVnd: 30_000 },
    ],
  });
  assert.deepEqual(pipelines.map(([stage]) => stage.$match).filter(Boolean), [
    { processingState: 'applied', verifiedAt: { $gte: from, $lte: to } },
    { recordedAt: { $gte: from, $lte: to } },
    { status: 'completed', updatedAt: { $gte: from, $lte: to } },
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
  }), { grossCollectedVnd: 0, refundedVnd: 0, daily: [] });
});

test('finance ledger rejects a daily series that cannot reconcile to its headline total', async () => {
  const port = createFinanceLedgerPort({
    PaymentEvent: aggregateModel(100_000, [], [{ _id: '2026-10-01', totalVnd: 50_000 }]),
    CodCollection: aggregateModel(0),
    Refund: aggregateModel(0),
  });

  await assert.rejects(() => port.getStatistics({
    from: new Date('2026-10-01T00:00:00.000Z'),
    to: new Date('2026-10-01T23:59:59.999Z'),
  }), /daily totals do not match/);
});
