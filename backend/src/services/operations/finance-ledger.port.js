function amountTotal(Model, match) {
  return Model.aggregate([
    { $match: match },
    { $group: { _id: null, totalVnd: { $sum: '$amountVnd' } } },
  ]).then((rows) => rows[0]?.totalVnd ?? 0);
}

function dailyAmountTotals(Model, field, { from, to, timezone, match = {} }) {
  return Model.aggregate([
    { $match: { ...match, [field]: { $gte: from, $lte: to } } },
    { $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone } },
      totalVnd: { $sum: '$amountVnd' },
    } },
    { $sort: { _id: 1 } },
  ]);
}

// Date bounds arrive as instants; the admin page constructs inclusive Asia/Ho_Chi_Minh day bounds.
export function createFinanceLedgerPort({ PaymentEvent, CodCollection, Refund }) {
  if (![PaymentEvent, CodCollection, Refund].every((model) => typeof model?.aggregate === 'function')) {
    throw new TypeError('Finance ledger requires payment event, COD collection, and refund aggregate models');
  }

  return Object.freeze({
    async getStatistics({ from, to, timezone = 'Asia/Ho_Chi_Minh' } = {}) {
      if (!(from instanceof Date) || Number.isNaN(from.getTime())
        || !(to instanceof Date) || Number.isNaN(to.getTime()) || from > to) {
        throw new TypeError('Finance ledger requires a valid inclusive date range');
      }
      if (timezone !== 'Asia/Ho_Chi_Minh') throw new TypeError('Finance ledger supports Asia/Ho_Chi_Minh only');

      const range = { $gte: from, $lte: to };
      const [payosCollectedVnd, codCollectedVnd, refundedVnd, payosDaily, codDaily, refundsDaily] = await Promise.all([
        amountTotal(PaymentEvent, { processingState: 'applied', verifiedAt: range }),
        amountTotal(CodCollection, { recordedAt: range }),
        amountTotal(Refund, { status: 'completed', updatedAt: range }),
        dailyAmountTotals(PaymentEvent, 'verifiedAt', {
          from, to, timezone, match: { processingState: 'applied' },
        }),
        dailyAmountTotals(CodCollection, 'recordedAt', { from, to, timezone }),
        dailyAmountTotals(Refund, 'updatedAt', { from, to, timezone, match: { status: 'completed' } }),
      ]);

      const reportedGrossVnd = payosCollectedVnd + codCollectedVnd;
      const dailyGrossVnd = payosDaily.reduce((sum, row) => sum + row.totalVnd, 0)
        + codDaily.reduce((sum, row) => sum + row.totalVnd, 0);
      const collectedByDay = new Map();
      for (const row of [...payosDaily, ...codDaily]) {
        collectedByDay.set(row._id, (collectedByDay.get(row._id) || 0) + row.totalVnd);
      }
      const refundedByDay = new Map(refundsDaily.map((row) => [row._id, row.totalVnd]));
      const daily = [...new Set([...collectedByDay.keys(), ...refundedByDay.keys()])]
        .sort()
        .map((date) => ({
          date,
          grossCollectedVnd: collectedByDay.get(date) || 0,
          refundedVnd: refundedByDay.get(date) || 0,
        }));
      if (dailyGrossVnd !== reportedGrossVnd) throw new TypeError('Finance ledger daily totals do not match headline total');

      return {
        grossCollectedVnd: reportedGrossVnd,
        refundedVnd,
        daily,
      };
    },
  });
}
