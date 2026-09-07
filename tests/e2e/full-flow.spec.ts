import { test, expect } from "@playwright/test";
import { login, mockGeolocation } from "./helpers";
import path from "node:path";

const FIXTURE = path.join(__dirname, "fixtures", "shop.jpg");

test("rep submits a survey and the admin can open it", async ({ page, context }) => {
  await mockGeolocation(context);
  await login(page, "rep.two");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /new survey/i }).click();
  await page.getByLabel("Shop name").fill("Playwright Fans");
  await page.getByLabel("Market").selectOption("Waterpump");
  await page.getByLabel("Shop size").selectOption("Medium");
  await page.getByLabel("Customer name").fill("Test Customer");
  await page.getByLabel("Customer number").fill("03007654321");
  await page.getByRole("button", { name: /capture location/i }).click();
  await expect(page.getByText(/±\s*\d+\s*m/)).toBeVisible();

  await page.getByTestId("front-gallery-input").setInputFiles(FIXTURE);
  await page.getByTestId("inner-gallery-input").setInputFiles(FIXTURE);
  await page.getByLabel("Most selling fan").selectOption("GFC");
  await page.getByLabel("30W — Recommend 1").selectOption("Tamoor");
  await page.getByLabel("50W — Recommend 1").selectOption("Royal");

  await page.getByRole("button", { name: /submit survey/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Playwright Fans")).toBeVisible();

  // Admin side
  await page.context().clearCookies();
  await login(page, "admin");
  await page.goto("/admin/surveys");
  await page.getByLabel("Search").fill("Playwright Fans");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByText("Playwright Fans").click();
  await expect(page.getByText(/most selling fan/i)).toBeVisible();
  await expect(page.getByText("GFC")).toBeVisible();
});
