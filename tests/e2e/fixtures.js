export const WEB_ORIGIN = 'http://127.0.0.1:5190';
export const API_PORT = 5191;
export const WEB_PORT = 5190;
export const FIXTURE_PASSWORD = 'P11-only-local-fixture-password';

export const USERS = Object.freeze({
  customer: Object.freeze({
    name: 'P11 Synthetic Customer',
    email: 'customer.p11@example.test',
    role: 'customer',
  }),
  otherCustomer: Object.freeze({
    name: 'P11 Other Synthetic Customer',
    email: 'other.customer.p11@example.test',
    role: 'customer',
  }),
  staff: Object.freeze({
    name: 'P11 Synthetic Staff',
    email: 'staff.p11@example.test',
    role: 'staff',
  }),
  admin: Object.freeze({
    name: 'P11 Synthetic Admin',
    email: 'admin.p11@example.test',
    role: 'admin',
  }),
});

export const PUBLISHED_PRODUCT = Object.freeze({
  slug: 'p11-fixture-ceramic-vase',
  sku: 'P11-E2E-PUBLISHED',
  name: 'P11 Fixture — bình gốm kiểm thử',
  priceVnd: 120_000,
  images: [
    { url: '/assets/products/concepts/lifestyle/hu-tra-01-front.jpg', alt: 'Ảnh concept AI P11, góc chính; không phải SKU thật', sortOrder: 0 },
    { url: '/assets/products/concepts/lifestyle/hu-tra-02-detail.jpg', alt: 'Ảnh concept AI P11, chi tiết; không phải SKU thật', sortOrder: 1 },
    { url: '/assets/products/concepts/lifestyle/hu-tra-03-context.jpg', alt: 'Ảnh concept AI P11, bối cảnh; không phải SKU thật', sortOrder: 2 },
  ],
});

export const DEMO_REFERENCE_PRODUCT = Object.freeze({
  slug: 'p11-demo-purchase-guard',
  sku: 'DEMO-DIP-005',
  name: 'P11 Demo Purchase Guard Fixture',
  priceVnd: 5_200_000,
  images: PUBLISHED_PRODUCT.images,
});

export const ASSISTANT_PRODUCT = Object.freeze({
  slug: 'p11-fixture-hu-tra',
  sku: 'P11-ASSISTANT-HUTRA',
  name: 'P11 Fixture — Hũ trà',
  priceVnd: 345_000,
});

export const DRAFT_PRODUCT = Object.freeze({
  slug: 'p11-fixture-draft-only',
  sku: 'P11-E2E-DRAFT',
  name: 'P11 Fixture — sản phẩm nháp kín',
});

export const STAFF_ORDER_CODE = 'TL-P11-SHIPMENT';
export const PAYMENT_ORDER_CODE = 'TL-P11-PAYMENT-RETURN';
export const GUEST_ORDER_CODE = 'TL-P11-GUEST-PRIVATE';
export const GUEST_ORDER_EMAIL = 'guest.private.p11@example.test';
export const REVIEW_ORDER_CODE = 'TL-P11-REVIEW-DELIVERED';

export function assertDedicatedLocalMongoUri(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Set P11_E2E_MONGODB_URI to a dedicated local replica-set test database URI.');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('P11_E2E_MONGODB_URI is not a valid MongoDB URI.');
  }

  const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)
    || !allowedHosts.has(parsed.hostname)
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash) {
    throw new Error('P11 E2E accepts only an unauthenticated loopback MongoDB URI without query options.');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ''));
  if (!/^tro_lam_p11_e2e_test_[a-f0-9]{12}$/u.test(databaseName)) {
    throw new Error('The Mongo database name must be tro_lam_p11_e2e_test_<12 lowercase hex chars>.');
  }

  return Object.freeze({ uri: value, databaseName });
}
