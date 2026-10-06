import { startRuntime } from './runtime.js';

export default async function globalSetup() {
  const runtime = await startRuntime();
  globalThis.__P11_E2E_RUNTIME = runtime;
  process.env.P11_E2E_FIXTURE_PRODUCT_ID = runtime.fixture.publishedProductId;
  process.env.P11_E2E_FIXTURE_DRAFT_ID = runtime.fixture.draftProductId;
  process.env.P11_E2E_OTHER_ADDRESS_ID = runtime.fixture.otherCustomerAddressId;
  process.env.P11_E2E_FIXTURE_STAFF_ORDER_ID = runtime.fixture.staffOrderId;
  process.env.P11_E2E_FIXTURE_PAYMENT_ORDER_ID = runtime.fixture.paymentOrderId;
  process.env.P11_E2E_FIXTURE_GUEST_ORDER_ID = runtime.fixture.guestOrderId;
  process.env.P11_E2E_FIXTURE_CUSTOMER_NOTIFICATION_IDS = runtime.fixture.customerNotificationIds.join(',');
  process.env.P11_E2E_FIXTURE_OTHER_NOTIFICATION_ID = runtime.fixture.otherCustomerNotificationId;
}
