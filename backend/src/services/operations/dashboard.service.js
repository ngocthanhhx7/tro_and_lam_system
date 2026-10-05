import { unavailable } from '../../utils/serviceError.js';
import { parseDateRange } from '../../validators/operations.validator.js';

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'];
const ACTIVE_TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'waiting_customer'];

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

export function createDashboardService({ Order, Ticket, Contact, Notification, orderMetrics, inventoryMetrics, financeLedger } = {}) {
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
    return {
      orderQueues: {
        pending,
        processing,
        deliveryFailed: Number.isSafeInteger(orderPortMetrics.deliveryFailed) ? orderPortMetrics.deliveryFailed : null,
        assignedToMe: Number.isSafeInteger(orderPortMetrics.assignedToMe) ? orderPortMetrics.assignedToMe : null,
      },
      ticketQueues: { unassigned: unassignedTickets, assignedToMe: assignedToMeTickets },
      lowStock: Number.isSafeInteger(lowStock) && lowStock >= 0 ? lowStock : null,
      operationalCounts: {
        newContacts: Number.isSafeInteger(newContacts) && newContacts >= 0 ? newContacts : null,
        unreadNotifications: Number.isSafeInteger(unreadNotifications) && unreadNotifications >= 0 ? unreadNotifications : null,
      },
    };
  }

  async function getAdminStatistics({ from: fromValue, to: toValue } = {}) {
    const { from, to } = parseDateRange({ from: fromValue, to: toValue });
    if (!from || !to) throw unavailable('DATABASE_UNAVAILABLE', 'Statistics cần from và to');
    if (!Order?.aggregate || !financeLedger?.getStatistics) {
      throw unavailable('PAYMENT_UNAVAILABLE', 'Order/payment ledger chưa được kết nối');
    }
    const range = createdAtRange(from, to);
    const [groupedOrders, topProducts, ledger] = await Promise.all([
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
      financeLedger.getStatistics({ from, to, timezone: 'Asia/Ho_Chi_Minh' }),
    ]);
    const orderCounts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));
    for (const row of groupedOrders) if (ORDER_STATUSES.includes(row._id)) orderCounts[row._id] = row.count;
    const grossCollectedVnd = safeMoney(ledger.grossCollectedVnd, 'grossCollectedVnd');
    const refundedVnd = safeMoney(ledger.refundedVnd, 'refundedVnd');
    return {
      grossCollectedVnd,
      refundedVnd,
      netCollectedVnd: grossCollectedVnd - refundedVnd,
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
