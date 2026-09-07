import { test, expect } from "@playwright/test";

test("rep can open one of their own surveys from the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("rep.one");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  const firstRow = page.locator("ul li a").first();
  await firstRow.click();
  await expect(page).toHaveURL(/\/survey\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/most selling fan/i)).toBeVisible();
});
