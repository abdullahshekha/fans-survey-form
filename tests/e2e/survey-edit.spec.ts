import { test, expect } from "@playwright/test";
import { login, mockGeolocation } from "./helpers";
import path from "node:path";

const FIXTURE = path.join(__dirname, "fixtures", "shop.jpg");
const AUDIO = path.join(__dirname, "fixtures", "note.mp3");

test("a rep edits a submitted survey and the admin sees the change", async ({ page, context }) => {
  await mockGeolocation(context);
  await login(page, "rep.two");
  await expect(page).toHaveURL(/\/dashboard$/);

  // Create a survey to edit.
  await page.getByRole("link", { name: /new survey/i }).click();
  await page.getByLabel("Shop name").fill("Editable Fans");
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

  // Open it, go to edit.
  await page.getByText("Editable Fans").click();
  await page.getByRole("link", { name: /edit survey/i }).click();
  await expect(page).toHaveURL(/\/survey\/.+\/edit$/);

  // Change the name, replace the front photo, upload a voice note.
  await page.getByLabel("Shop name").fill("Edited Fans");
  await page.getByTestId("front-camera-input").setInputFiles(FIXTURE);
  await page.getByTestId("audio-upload-input").setInputFiles(AUDIO);
  await page.getByRole("button", { name: /save changes/i }).click();

  await expect(page).toHaveURL(/\/survey\/[^/]+$/);
  await expect(page.getByText("Edited Fans")).toBeVisible();
  await expect(page.getByText(/edited/i)).toBeVisible();

  // Admin sees the new name and the Edited badge.
  await page.context().clearCookies();
  await login(page, "admin");
  await page.goto("/admin/surveys");
  await page.getByLabel("Search").fill("Edited Fans");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Edited Fans")).toBeVisible();
  await expect(page.getByText("Edited", { exact: true })).toBeVisible();
});
