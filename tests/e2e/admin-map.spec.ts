import { test, expect } from "@playwright/test";

test("admin map renders tiles and a legend", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin/map");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByText("Arambagh", { exact: true })).toBeVisible();
});
