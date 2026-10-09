import { unavailable } from '../../utils/serviceError.js';
import { parseAdminStatisticsRange, parseDateRange } from '../../validators/operations.validator.js';

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'];
const ACTIVE_TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'waiting_customer'];
const DASHBOARD_TIMEZONE = 'Asia/Ho_Chi_Minh';
const DASHBOARD_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: DASHBOARD_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

function localDateKey(value) {
  const parts = Object.fromEntries(DASHBOARD_DATE_FORMATTER.formatToParts(value).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateKeys(from, to) {
  const first = localDateKey(from);
  const last = localDateKey(to);
  const result = [];
  const cursor = new Date(`${first}T00:00:00.000Z`);
  while (cursor.toISOString().slice(0, 10) <= last) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function dailyCollectedSeries(rows, from, to, length = dateKeys(from, to).length) {
  if (!Array.isArray(rows)) throw unavailable('PAYMENT_UNAVAILABLE', 'Finance ledger thiếu chuỗi thu theo ngày');
  const keys = dateKeys(from, to);
  const allowedDates = new Set(keys);
  const amounts = new Map();
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(row?.date) || !allowedDates.has(row.date)) {
      throw unavailable('PAYMENT_UNAVAILABLE', 'Finance ledger trả về ngày không hợp lệ');
    }
    const amount = safeMoney(row.grossCollectedVnd, 'daily.grossCollectedVnd');
    if (amounts.has(row.date)) throw unavailable('PAYMENT_UNAVAILABLE', 'Finance ledger trả về ngày bị trùng');
    amounts.set(row.date, amount);
  }
  return keys.slice(0, length).map((date) => ({ date, grossCollectedVnd: amounts.get(date) || 0 }));
}

function previousPeriod(from, to) {
  const duration = to.getTime() - from.getTime() + 1;
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - duration + 1);
  return { from: previousFrom, to: previousTo };
}

function comparisonDate(value) {
  return localDateKey(value);
}

function createdAtRange(from, to) {
  if (!from && !to) return {};
  return { createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } };
}

function countDocuments(model, query) {
  if (!model || typeof model.countDocuments !== 'function') return Promise.resolve(null);
  return model.countDocuments(query);
}

function safeMoney(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw unavailable('PAYMENT_UNAVAILABLE', `Ledger trả về ${field} không hợp lệ`);
  }
  return value;
}

export function createDashboardService({ Order, Ticket, Contact, Notification, User, Inventory, orderMetrics, inventoryMetrics, financeLedger } = {}) {
  async function getStaffDashboard({ actorId, from: fromValue, to: toValue } = {}) {
    const { from, to } = parseDateRange({ from: fromValue, to: toValue });
    if (!Order || !Ticket) throw unavailable('DATABASE_UNAVAILABLE', 'Order/support data source chưa được kết nối');
    const range = createdAtRange(from, to);
    const [pending, processing, unassignedTickets, assignedToMeTickets, newContacts, unreadNotifications] = await Promise.all([
      countDocuments(Order, { ...range, status: 'pending' }),
      countDocuments(Order, { ...range, status: 'processing' }),
      countDocuments(Ticket, { ...range, status: 'open', $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] }),
      countDocuments(Ticket, { ...range, assignedTo: actorId, status: { $in: ACTIVE_TICKET_STATUSES } }),
      countDocuments(Contact, { ...range, status: 'new' }),
      countDocuments(Notification, { userId: actorId, readAt: null }),
    ]);
    if ([pending, processing, unassignedTickets, assignedToMeTickets].some((value) => value === null)) {
      throw unavailable('DATABASE_UNAVAILABLE', 'Order/support metrics chưa sẵn sàng');
    }
    const [orderPortMetrics, lowStock] = await Promise.all([
      orderMetrics?.getStaffQueueMetrics?.({ actorId, from, to }) || {},
      inventoryMetrics?.getLowStockMetric?.({ from, to }) ?? null,
    ]);
    const inventoryAlerts = Inventory?.aggregate ? {
      threshold: 5,
      items: await Inventory.aggregate([
        { $addFields: { available: { $subtract: ['$onHand', '$reserved'] } } },
        { $match: { available: { $lte: 5 } } },
        { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $match: { 'product.status': 'published', 'product.saleMode': { $in: ['buy', 'both'] } } },
        { $sort: { available: 1, productId: 1 } },
        { $limit: 10 },
        { $project: { _id: 0, productId: { $toString: '$productId' }, sku: '$product.sku', name: '$product.name', onHand: 1, reserved: 1, available: 1 } },
      ]),
    } : null;
    return {
      orderQueues: {
        pending,
        processing,
        deliveryFailed: Number.isSafeInteger(orderPortMetrics.deliveryFailed) ? orderPortMetrics.deliveryFailed : null,
        assignedToMe: Number.isSafeInteger(orderPortMetrics.assignedToMe) ? orderPortMetrics.assignedToMe : null,
      },
      ticketQueues: { unassigned: unassignedTickets, assignedToMe: assignedToMeTickets },
      lowStock: Number.isSafeInteger(lowStock) && lowStock >= 0 ? lowStock : null,
      inventoryAlerts,
      operationalCounts: {
        newContacts: Number.isSafeInteger(newContacts) && newContacts >= 0 ? newContacts : null,
        unreadNotifications: Number.isSafeInteger(unreadNotifications) && unreadNotifications >= 0 ? unreadNotifications : null,
      },
    };
  }

  async function getAdminStatistics({ from: fromValue, to: toValue } = {}) {
    const { from, to } = parseAdminStatisticsRange({ from: fromValue, to: toValue });
    if (!Order?.aggregate || !financeLedger?.getStatistics) {
      throw unavailable('PAYMENT_UNAVAILABLE', 'Order/payment ledger chưa được kết nối');
    }
    const range = createdAtRange(from, to);
    const prior = previousPeriod(from, to);
    const [groupedOrders, topProducts, ledger, comparisonLedger, customerCount] = await Promise.all([
      Order.aggregate([
        { $match: range },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { ...range, status: { $nin: ['cancelled'] } } },
        { $unwind: '$itemsSnapshot' },
        { $group: {
          _id: '$itemsSnapshot.productId',
          sku: { $first: '$itemsSnapshot.sku' },
          name: { $first: '$itemsSnapshot.name' },
          quantity: { $sum: '$itemsSnapshot.quantity' },
          orderIds: { $addToSet: '$_id' },
        } },
        { $addFields: { orderCount: { $size: '$orderIds' } } },
        { $sort: { quantity: -1, _id: 1 } },
        { $limit: 5 },
        { $project: { _id: 0, productId: '$_id', sku: 1, name: 1, quantity: 1, orderCount: 1 } },
      ]),
      financeLedger.getStatistics({ from, to, timezone: DASHBOARD_TIMEZONE }),
      financeLedger.getStatistics({ ...prior, timezone: DASHBOARD_TIMEZONE }),
      countDocuments(User, { ...range, role: 'customer' }),
    ]);
    const orderCounts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));
    for (const row of groupedOrders) if (ORDER_STATUSES.includes(row._id)) orderCounts[row._id] = row.count;
    const grossCollectedVnd = safeMoney(ledger.grossCollectedVnd, 'grossCollectedVnd');
    const refundedVnd = safeMoney(ledger.refundedVnd, 'refundedVnd');
    const comparisonGrossCollectedVnd = safeMoney(comparisonLedger.grossCollectedVnd, 'comparison.grossCollectedVnd');
    const dailyRevenue = dailyCollectedSeries(ledger.daily, from, to);
    const comparisonDailyRevenue = dailyCollectedSeries(comparisonLedger.daily, prior.from, prior.to, dailyRevenue.length);
    return {
      grossCollectedVnd,
      refundedVnd,
      netCollectedVnd: grossCollectedVnd - refundedVnd,
      customerCount,
      comparison: {
        from: prior.from.toISOString(),
        to: prior.to.toISOString(),
        grossCollectedVnd: comparisonGrossCollectedVnd,
        deltaVnd: grossCollectedVnd - comparisonGrossCollectedVnd,
        changePercent: comparisonGrossCollectedVnd === 0
          ? null
          : Number((((grossCollectedVnd - comparisonGrossCollectedVnd) / comparisonGrossCollectedVnd) * 100).toFixed(1)),
      },
      revenueTrend: {
        timezone: DASHBOARD_TIMEZONE,
        daily: dailyRevenue,
        comparisonDaily: comparisonDailyRevenue.map((row, index) => ({
          date: dailyRevenue[index]?.date ?? comparisonDate(prior.from),
          comparisonDate: row.date,
          grossCollectedVnd: row.grossCollectedVnd,
        })),
      },
      orderCounts,
      topProducts: topProducts.map((product) => ({
        productId: String(product.productId),
        sku: product.sku,
        name: product.name,
        quantity: product.quantity,
        orderCount: product.orderCount,
      })),
    };
  }

  return Object.freeze({ getStaffDashboard, getAdminStatistics });
}
