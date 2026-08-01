import { test, expect } from '@playwright/test';

test('has title and loads successfully', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/OpenWA|Dashboard|Vite React/i);
});
