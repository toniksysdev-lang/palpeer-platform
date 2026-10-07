import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByRole('textbox', { name: 'Email' }).fill('ops@palpeer.local');
  await page.locator('#password').fill('admin');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByText(/palpeer control surface/i)).toBeVisible();
}

function primaryNav(page: Page) {
  return page.getByRole('complementary', { name: /^primary$/i });
}

test.describe('Admin critical workflows (mock)', () => {
  test('1. Admin login', async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('2. Dashboard loading', async ({ page }) => {
    await signIn(page);
    await expect(page.getByText(/mock mode/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
  });

  test('3–4. Users list and detail', async ({ page }) => {
    await signIn(page);
    await primaryNav(page).getByRole('link', { name: /^users$/i }).click();
    await expect(page.getByRole('main').getByRole('heading', { name: /^users$/i })).toBeVisible();
    await expect(page.getByRole('main').getByText('operator@palpeer.local')).toBeVisible();
    const row = page.getByRole('main').locator('tr', { hasText: 'operator@palpeer.local' });
    await row.getByRole('button', { name: /^open$/i }).click();
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'operator@palpeer.local' }),
    ).toBeVisible();
  });

  test('5–6. Transaction search and detail drawer', async ({ page }) => {
    await signIn(page);
    await primaryNav(page).getByRole('link', { name: /^transactions$/i }).click();
    await page.getByLabel(/user id/i).fill('00000000-0000-4000-8000-000000000001');
    await page.getByRole('button', { name: /load for user/i }).click();
    const funding = page.getByRole('main').getByRole('table').getByText('FUNDING');
    await expect(funding).toBeVisible();
    await funding.click();
    await expect(page.getByRole('dialog', { name: /transaction detail/i })).toBeVisible();
  });

  test('7. Rate workflow', async ({ page }) => {
    await signIn(page);
    await primaryNav(page).getByRole('link', { name: /^rates$/i }).click();
    await expect(page.getByRole('main').getByRole('heading', { name: /rates & currencies/i })).toBeVisible();
    await expect(page.getByRole('main').getByText('CAD').first()).toBeVisible();
    await expect(page.getByRole('main').getByText('NGN').first()).toBeVisible();
  });

  test('8. KYC workflow', async ({ page }) => {
    await signIn(page);
    await primaryNav(page).getByRole('link', { name: /^kyc$/i }).click();
    await expect(page.getByRole('main').getByRole('heading', { name: /kyc cases/i })).toBeVisible();
    await page.getByRole('main').getByRole('button', { name: /^review$/i }).first().click();
    await expect(page.getByRole('main').getByText(/kyc case/i).first()).toBeVisible();
  });

  test('9. P2P workflow', async ({ page }) => {
    await signIn(page);
    await primaryNav(page).getByRole('link', { name: /^p2p$/i }).click();
    await expect(page.getByRole('main').getByRole('heading', { name: /^p2p$/i })).toBeVisible();
    await expect(page.getByRole('main').getByText(/BUY\s+NGN\/CAD/i)).toBeVisible();
  });

  test('10. Logout', async ({ page }) => {
    await signIn(page);
    await primaryNav(page).getByRole('button', { name: /^logout$/i }).click();
    await expect(page.getByRole('heading', { name: /admin access/i })).toBeVisible();
    await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading', { name: /admin access/i })).toBeVisible();
  });
});
