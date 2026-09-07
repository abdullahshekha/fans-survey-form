import { test, expect } from "@playwright/test";

test("unauthenticated user is sent to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("rep signs in and lands on the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("rep.one");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("rep cannot open the admin area", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("rep.one");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin/overview");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("admin signs in and lands on the overview", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/overview$/);
});
