import { expect, test } from '@playwright/test';

test('signed-out administration preserves administrator intent and accessible entry', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('link', { name: 'Administrator sign in', exact: true })).toHaveAttribute('href', '/admin/login');
  await page.getByRole('link', { name: 'Administrator sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: 'Administrator sign in', exact: true })).toBeVisible();
  await expect(page.getByLabel('Email address', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
});

test('administrator account creation clearly requires separate privilege approval', async ({ page }) => {
  await page.goto('/admin/signup');
  await expect(page.getByRole('heading', { name: 'Create an administrator sign-in account' })).toBeVisible();
  await expect(page.getByText('Account creation and permission approval are separate steps.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create sign-in account', exact: true })).toBeVisible();
  for (const width of [320, 700]) {
    await page.setViewportSize({ width, height: 800 });
    const clipped = await page.locator('input, button, h1').evaluateAll((nodes) => nodes.some((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left < 0 || rect.right > window.innerWidth + 1;
    }));
    expect(clipped).toBe(false);
  }
});

test('administrator list and workspace access projection require authentication', async ({ request }) => {
  for (const route of ['/api/admin/roles', '/api/account/access']) {
    const response = await request.get(route);
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ success: false });
  }
});
