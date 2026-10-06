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
