import { test, expect } from "@playwright/test";

test("admin filters surveys by market", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin/surveys");
  await page.getByLabel("Market").selectOption("Arambagh");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/market=Arambagh/);
});
