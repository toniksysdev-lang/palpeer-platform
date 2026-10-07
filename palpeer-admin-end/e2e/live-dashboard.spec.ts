import { expect, test } from '@playwright/test';

test('live login reaches dashboard', async ({ page }) => {
  page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE', msg.text());
  });

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('admin@palpeer.local');
  await page.locator('#password').fill('Admin123!');
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 20000 });
  await expect(page.getByText(/palpeer control surface/i)).toBeVisible({ timeout: 20000 });
});
