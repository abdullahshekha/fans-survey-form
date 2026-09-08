import { test, expect } from "@playwright/test";

test("admin adds a rep and sees it in the table", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin/users");
  const unique = `rep.e2e${Date.now().toString().slice(-5)}`;
  await page.getByLabel("Username").fill(unique);
  await page.getByLabel("Full name").fill("E2E Rep");
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: "Add rep" }).click();
  await expect(page.getByText(unique)).toBeVisible();
});
