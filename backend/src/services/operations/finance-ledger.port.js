function amountTotal(Model, match) {
  return Model.aggregate([
    { $match: match },
    { $group: { _id: null, totalVnd: { $sum: '$amountVnd' } } },
  ]).then((rows) => rows[0]?.totalVnd ?? 0);
}

// Date bounds arrive as instants; the admin page constructs inclusive Asia/Ho_Chi_Minh day bounds.
export function createFinanceLedgerPort({ PaymentEvent, CodCollection, Refund }) {
  if (![PaymentEvent, CodCollection, Refund].every((model) => typeof model?.aggregate === 'function')) {
    throw new TypeError('Finance ledger requires payment event, COD collection, and refund aggregate models');
  }

  return Object.freeze({
    async getStatistics({ from, to } = {}) {
      if (!(from instanceof Date) || Number.isNaN(from.getTime())
        || !(to instanceof Date) || Number.isNaN(to.getTime()) || from > to) {
        throw new TypeError('Finance ledger requires a valid inclusive date range');
      }

      const range = { $gte: from, $lte: to };
      const [payosCollectedVnd, codCollectedVnd, refundedVnd] = await Promise.all([
        amountTotal(PaymentEvent, { processingState: 'applied', verifiedAt: range }),
        amountTotal(CodCollection, { recordedAt: range }),
        amountTotal(Refund, { status: 'completed', updatedAt: range }),
      ]);

      return {
        grossCollectedVnd: payosCollectedVnd + codCollectedVnd,
        refundedVnd,
      };
    },
  });
}
