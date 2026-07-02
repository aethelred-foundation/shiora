import { test, expect } from '@playwright/test';

test.describe('home page', () => {
  test('loads with the correct title and an accessible skip link', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Shiora/);

    // The skip link is visually hidden but must be in the DOM for keyboard users.
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await expect(skipLink).toBeAttached();

    // The main landmark the skip link targets exists.
    await expect(page.locator('#main-content')).toBeAttached();

    // Defaults to English, left-to-right.
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });
});
