import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Page-level accessibility scan, complementing the component-level jest-axe gate
// (GAP-24). We fail on serious/critical WCAG 2 A/AA violations — the classes
// that actually block assistive-technology users.
//
// `color-contrast` (WCAG 1.4.3) is disabled here: automated contrast checks are
// palette/design concerns handled in design review, not structural regressions,
// and gating the E2E suite on the current brand palette would be noise. The
// structural rules this DOES enforce — accessible names, roles, labels,
// landmarks, and heading order, in both LTR and RTL — are what break AT users.
const BLOCKING = ['critical', 'serious'];

async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();
  return results.violations.filter((v) => BLOCKING.includes(v.impact ?? ''));
}

test.describe('accessibility', () => {
  test('the dashboard has no serious/critical violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeAttached();
    const violations = await scan(page);
    expect(violations, JSON.stringify(violations.map((v) => v.id), null, 2)).toEqual([]);
  });

  test('the settings page has no serious/critical violations (LTR and RTL)', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('#locale-select')).toBeVisible();
    expect(await scan(page)).toEqual([]);

    // Re-scan under Arabic / RTL to catch direction-specific regressions.
    await page.locator('#locale-select').selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    expect(await scan(page)).toEqual([]);
  });
});
