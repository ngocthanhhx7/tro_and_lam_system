import { expect, test } from '@playwright/test';

test('email verification keeps the fragment token through URL cleanup and submits it once', async ({ page }) => {
  const token = 'browser-only-verification-token';
  let verifyRequests = 0;

  await page.route('**/api/v1/auth/csrf', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { csrfToken: 'browser-test-csrf-token' } }),
  }));
  await page.route('**/api/v1/auth/verify-email', async (route) => {
    verifyRequests += 1;
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ token });
    expect(route.request().headers()['x-csrf-token']).toBe('browser-test-csrf-token');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { verified: true } }),
    });
  });

  await page.goto(`/xac-minh-email#token=${token}`);
  await expect(page).toHaveURL(/\/xac-minh-email$/u);
  await expect(page.locator('.identity-feedback--success')).toContainText('Email đã được xác minh');
  await page.waitForTimeout(100);

  expect(verifyRequests).toBe(1);
});

test('expired email verification is shown as an error and lets the customer request a fresh link', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { csrfToken: 'browser-test-csrf-token' } }),
  }));
  await page.route('**/api/v1/auth/verify-email', (route) => route.fulfill({
    status: 410,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'LINK_EXPIRED', message: 'Liên kết xác minh đã hết hạn hoặc đã được sử dụng' } }),
  }));
  await page.route('**/api/v1/auth/resend-verification', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email: 'an@example.com' });
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ data: { accepted: true } }) });
  });

  await page.goto('/xac-minh-email#token=expired-verification-token');
  const error = page.getByRole('alert');
  await expect(error).toContainText('đã hết hạn hoặc đã được sử dụng');
  await expect(error).toHaveClass(/identity-feedback--error/u);
  await expect(page.locator('.identity-feedback--success')).toHaveCount(0);

  await page.getByLabel('Gửi lại tới email').fill('an@example.com');
  await page.getByRole('button', { name: 'Gửi lại hướng dẫn' }).click();
  await expect(page.getByRole('status')).toContainText('hướng dẫn đã được xếp gửi');
});
