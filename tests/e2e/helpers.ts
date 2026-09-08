import { type Page, type BrowserContext } from "@playwright/test";

export async function login(page: Page, username: string, password = "test-pass-123") {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function mockGeolocation(context: BrowserContext, coords = { latitude: 24.8607, longitude: 67.0011 }) {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: coords.latitude, longitude: coords.longitude, accuracy: 10 });
}
