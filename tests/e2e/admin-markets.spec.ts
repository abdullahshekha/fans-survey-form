import { test, expect } from "@playwright/test";

test("admin adds a market and a rep sees it in the survey form", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.goto("/admin/housekeeping");
  await page.getByLabel("New market name").fill("E2E Test Market");
  await page.getByRole("button", { name: "Add market" }).click();
  await expect(page.getByText("E2E Test Market")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/login");
  await page.getByLabel("Username").fill("rep.one");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.goto("/survey/new");
  await expect(page.getByLabel("Market").locator('option[value="E2E Test Market"]')).toHaveCount(1);
});

test("admin renames a market and the new name shows in the surveys filter", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.goto("/admin/housekeeping");
  await page.getByRole("button", { name: "Rename Waterpump" }).click();
  await page.getByLabel("Rename Waterpump").fill("Water Pump Chowk");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Water Pump Chowk")).toBeVisible();

  await page.goto("/admin/surveys");
  await expect(page.getByLabel("Market").locator('option[value="Water Pump Chowk"]')).toHaveCount(1);
});
