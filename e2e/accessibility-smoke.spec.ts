import { expect, test } from '@playwright/test';

test.describe('public accessibility and secure fallback states', () => {
  test('direct patient-room navigation explains the invitation requirement', async ({ page }) => {
    await page.goto('/room/accessibility-check/patient');

    await expect(page.getByRole('main')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Secure invitation required' })
    ).toBeVisible();
    await expect(page.getByText(/room name alone cannot be used/i)).toBeVisible();

    const patientPortalLink = page.getByRole('link', { name: 'View patient portal' });
    await patientPortalLink.focus();
    await expect(patientPortalLink).toBeFocused();
  });

  test('access-denied guidance has a named heading and keyboard link', async ({ page }) => {
    await page.goto('/access-denied?reason=invalid-token');

    await expect(page.getByRole('heading')).toBeVisible();
    const homeLink = page.getByRole('link').first();
    await homeLink.focus();
    await expect(homeLink).toBeFocused();
  });
});
