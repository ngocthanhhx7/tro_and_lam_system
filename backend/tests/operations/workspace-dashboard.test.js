import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardService } from '../../src/services/operations/dashboard.service.js';
import { roleCapabilities } from '../../src/middlewares/identity/identity.middleware.js';

test('admin can operate orders while customer cannot', () => {
  assert.equal(roleCapabilities.admin.has('orders.operate'), true);
  assert.equal(roleCapabilities.customer.has('orders.operate'), false);
});

test('admin customer metric excludes staff and follows the selected date range', async () => {
  const queries = [];
  const dashboard = createDashboardService({
    Order: { aggregate: async () => [] },
    User: { countDocuments: async (query) => { queries.push(query); return 3; } },
    financeLedger: { getStatistics: async () => ({ grossCollectedVnd: 0, refundedVnd: 0, daily: [] }) },
  });
  const result = await dashboard.getAdminStatistics({ from: '2026-10-01T00:00:00+07:00', to: '2026-10-03T23:59:59.999+07:00' });
  assert.equal(result.customerCount, 3);
  assert.equal(queries[0].role, 'customer');
  assert.equal(queries[0].createdAt.$gte.toISOString(), '2026-09-30T17:00:00.000Z');
});

test('staff inventory alerts include a named current stock threshold and availability', async () => {
  const calls = [];
  const dashboard = createDashboardService({
    Order: { countDocuments: async () => 0 }, Ticket: { countDocuments: async () => 0 },
    Inventory: { aggregate: async (pipeline) => { calls.push(pipeline); return [{ productId: 'p1', name: 'Bình gốm', sku: 'B1', onHand: 5, reserved: 4, available: 1 }]; } },
  });
  const result = await dashboard.getStaffDashboard({ actorId: 'staff-1' });
  assert.equal(result.inventoryAlerts.threshold, 5);
  assert.equal(result.inventoryAlerts.items[0].available, 1);
  assert.ok(calls[0].some((stage) => stage.$match?.available?.$lte === 5));
});
