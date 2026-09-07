import { test, expect } from "@playwright/test";

test("rep dashboard shows count and new-survey link", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("rep.two");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("surveys submitted")).toBeVisible();
  await page.getByRole("link", { name: /new survey/i }).click();
  await expect(page).toHaveURL(/\/survey\/new$/);
});
