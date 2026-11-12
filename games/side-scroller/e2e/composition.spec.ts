import { expect, test } from "@playwright/test";
for (const viewport of [{ width: 390, height: 844 }, { width: 1180, height: 757 }]) {
  test(`home composition ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `e2e/screenshots/composition-${viewport.width}x${viewport.height}.png` });
  });
}
