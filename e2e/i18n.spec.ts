import { test, expect } from '@playwright/test';

test.describe('internationalization', () => {
  test('switching to Arabic flips the whole document to right-to-left', async ({ page }) => {
    await page.goto('/settings');

    const html = page.locator('html');
    const select = page.locator('#locale-select');
    await expect(select).toBeVisible();

    // Baseline: English, left-to-right.
    await expect(html).toHaveAttribute('dir', 'ltr');

    // Choose Arabic — the entire interface should mirror.
    await select.selectOption('ar');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'ar');
    // A translated string is now shown (the RTL note).
    await expect(page.getByText('تُعرض هذه اللغة من اليمين إلى اليسار.')).toBeVisible();

    // The choice persists across a reload (cookie + localStorage).
    await page.reload();
    await expect(html).toHaveAttribute('dir', 'rtl');

    // Switch back to English.
    await page.locator('#locale-select').selectOption('en');
    await expect(html).toHaveAttribute('dir', 'ltr');
  });
});
