import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
// @ts-ignore Test-runner-only imports; not part of the frontend bundle.
import { sequelize } from "../../backend-sermon-api/dist/config/database.js";
// @ts-ignore
import { User } from "../../backend-sermon-api/dist/models/index.js";
import bcrypt from "../../backend-sermon-api/node_modules/bcryptjs/index.js";
let user: any;
const password = "PhotoTestMember123!";
const photoUrl =
  "https://res.cloudinary.com/test/image/upload/profile-photo.jpg";
test.beforeAll(async () => {
  if (
    !["127.0.0.1", "localhost"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error("Use a local development database.");
  user = await User.create({
    name: "Photo Reader",
    email: `photo.${randomUUID()}@example.com`,
    passwordHash: await bcrypt.hash(password, 12),
  });
});
test.afterAll(async () => {
  try {
    if (user) await user.destroy();
  } finally {
    await sequelize.close();
  }
});
async function profile(page: any) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A word for your season." }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "My profile", exact: true })
    .click();
}
test("preview, multipart upload, shared avatars, replacement, cancellation and removal", async ({
  page,
}) => {
  await profile(page);
  const png = await readFile("tests/fixtures/test-photo.png");
  let uploads = 0;
  await page.route(photoUrl, (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.route("**/api/v1/users/me/avatar", async (route) => {
    if (route.request().method() === "PUT") {
      expect(route.request().headers()["content-type"]).toContain(
        "multipart/form-data; boundary=",
      );
      expect(route.request().headers()["authorization"]).toMatch(/^Bearer /);
      expect(route.request().postDataBuffer()?.toString()).toContain(
        'name="avatar"',
      );
      uploads++;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        data: {
          ...user.toJSON(),
          avatarUrl: route.request().method() === "DELETE" ? null : photoUrl,
        },
      }),
    });
  });
  await page
    .getByLabel("Choose profile photo")
    .setInputFiles("tests/fixtures/test-photo.png");
  await expect(page.getByAltText("New profile photo preview")).toBeVisible();
  await page.getByRole("button", { name: "Cancel selection" }).click();
  await expect(page.getByAltText("New profile photo preview")).toHaveCount(0);
  await page
    .getByLabel("Choose profile photo")
    .setInputFiles("tests/fixtures/test-photo.png");
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(
    page.getByText("Your profile photo has been updated."),
  ).toBeVisible();
  await expect(page.locator(`img[src="${photoUrl}"]`)).toHaveCount(4);
  await page
    .getByLabel("Choose profile photo")
    .setInputFiles("tests/fixtures/test-photo.png");
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect.poll(() => uploads).toBe(2);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/profile-photo-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await expect(
    page.getByText("Your profile photo has been removed."),
  ).toBeVisible();
  await expect(page.locator(`img[src="${photoUrl}"]`)).toHaveCount(0);
});
test("client validation and failed upload preserve existing avatar and selected file", async ({
  page,
}) => {
  await profile(page);
  await page.getByLabel("Choose profile photo").setInputFiles({
    name: "script.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(page.getByRole("alert")).toContainText("JPEG, PNG, or WebP");
  await page.getByLabel("Choose profile photo").setInputFiles({
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("alert")).toContainText("5 MiB");
  await expect(
    page.getByRole("button", { name: "Upload photo", exact: true }),
  ).toBeDisabled();
  await page.route("**/api/v1/users/me/avatar", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"message":"Profile photo storage is not configured. Please contact your administrator."}',
    }),
  );
  await page
    .getByLabel("Choose profile photo")
    .setInputFiles("tests/fixtures/test-photo.png");
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("not configured");
  await expect(page.getByAltText("New profile photo preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Upload photo", exact: true }),
  ).toBeEnabled();
});
test("broken photo falls back to initial; expired uploads cannot restore a signed-out session", async ({
  page,
}) => {
  await profile(page);
  const broken = "https://res.cloudinary.com/test/image/upload/unavailable.jpg";
  await page.route(broken, (route) => route.abort());
  await page.route("**/api/v1/users/me/avatar", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        data: { ...user.toJSON(), avatarUrl: broken },
      }),
    }),
  );
  await page
    .getByLabel("Choose profile photo")
    .setInputFiles("tests/fixtures/test-photo.png");
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(
    page.getByText("Your profile photo has been updated."),
  ).toBeVisible();
  await expect(page.locator(`img[src="${broken}"]`)).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "Photo Reader's profile picture" }),
  ).toHaveCount(3);
  await page.unroute("**/api/v1/users/me/avatar");
  await page.route("**/api/v1/users/me/avatar", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: '{"message":"Token expired"}',
    }),
  );
  await page
    .getByLabel("Choose profile photo")
    .setInputFiles("tests/fixtures/test-photo.png");
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(
    page.getByText("Your session ended. Please sign in again."),
  ).toBeVisible();
});
