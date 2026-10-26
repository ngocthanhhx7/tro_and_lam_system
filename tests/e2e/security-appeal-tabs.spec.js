import { test, expect } from '@playwright/test';

for (const [pathname, storageDisabled, activeSession] of [
  ['/tai-khoan/bi-khoa', false], ['/tai-khoan/bi-khoa', true],
  ['/TAI-KHOAN/BI-KHOA/', true], ['/%74ai-khoan/bi-khoa/', true],
  ['/tai-khoan/bi-khoa', true, true],
]) {
  test(`appeal proof replacement clears another tab's private state: ${pathname}, storage disabled=${storageDisabled}, active session=${Boolean(activeSession)}`, async ({ context, page }) => {
    if (storageDisabled) await context.addInitScript(() => {
      Storage.prototype.setItem = () => { throw new Error('Storage disabled for this fixture'); };
    });
    let proof = 'A';
    let uncertain = false;
    const second = await context.newPage();
    await context.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) });
      if (path.endsWith('/auth/me')) {
        if (uncertain) return route.abort();
        if (activeSession) return reply({ id: 'synthetic-active-user', name: 'Synthetic User', role: 'customer', status: 'active' });
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SESSION_EXPIRED' } }) });
      }
      if (path.endsWith('/auth/csrf')) return reply({ csrfToken: 'synthetic-csrf' });
      if (path.endsWith('/auth/appeal-challenges')) return reply({ challengeId: 'synthetic-challenge' }, 202);
      if (path.endsWith('/auth/appeal-access')) { proof = 'B'; return reply({ expiresAt: '2099-01-01T00:00:00Z' }); }
      if (path.endsWith('/account/appeals/current')) {
        if (proof === 'A' && route.request().frame().page() === second) return reply(null, 401);
        return reply({ status: 'pending', message: `Private appeal canary ${proof}`, submittedAt: '2026-01-01T00:00:00Z' });
      }
      return reply({ items: [], count: 0 });
    });
    await page.goto(pathname);
    await expect(page.getByText('Private appeal canary A', { exact: true })).toBeVisible();
    await second.goto('/tai-khoan/bi-khoa');
    await second.getByLabel('Email tài khoản', { exact: true }).fill('blocked-b@example.test');
    await second.getByRole('button', { name: 'Gửi mã xác minh', exact: true }).click();
    await second.getByLabel('Mã 6 chữ số trong email', { exact: true }).fill('123456');
    await second.getByRole('button', { name: 'Mở màn hình kháng nghị', exact: true }).click();
    await expect(second.getByText('Private appeal canary B', { exact: true })).toBeVisible();
    if (storageDisabled) await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect(page.getByText('Private appeal canary A', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Private appeal canary B', { exact: true })).toBeVisible();
    // An uncertain session check must hide private data rather than retain B.
    uncertain = true;
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
    await expect(page.getByText('Private appeal canary B', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Đang xác minh phiên truy cập' })).toBeVisible();
    await second.close();
  });
}
