import { test, expect, type Page } from "@playwright/test";

// Appearance tests isolate UI state; real authentication is covered by the member suite.
async function openProfile(page: Page) {
  const user = {
    id: "theme-user",
    name: "Theme Reader",
    email: "theme@example.com",
    role: "member",
    isActive: true,
    avatarUrl: null,
    createdAt: "2026-10-01T12:00:00Z",
  };
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        route.request().url().endsWith("/auth/login")
          ? { status: "success", data: { user, token: "theme-test-token" } }
          : {
              status: "success",
              data: [],
              meta: { page: 1, limit: 9, total: 0, totalPages: 1 },
            },
      ),
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("ThemeTest123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.getByRole("link", { name: "My profile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A little about you." }),
  ).toBeVisible();
}

test("system default follows live device appearance without writing storage", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("group", { name: "Color theme" })).toHaveCount(0);
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe("rgb(16, 13, 29)");
  expect(
    await page.evaluate(() => localStorage.getItem("onebody.theme")),
  ).toBeNull();
  await page.screenshot({
    path: "test-results/dark-login-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/register");
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Color theme" })).toHaveCount(0);
});

test("explicit choice persists, overrides device setting and synchronizes tabs", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openProfile(page);
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("group", { name: "Color theme" })).toHaveCount(0);
  await openProfile(page);
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#100d1d",
  );
  const second = await context.newPage();
  await second.emulateMedia({ colorScheme: "light" });
  await openProfile(second);
  await expect(second.locator("html")).toHaveAttribute("data-theme", "dark");
  await second.getByRole("button", { name: "System", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("button", { name: "System", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("invalid preferences fall back to system and blocked storage does not break switching", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() =>
    localStorage.setItem("onebody.theme", "invalid"),
  );
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const blocked = await context.newPage();
  await blocked.setViewportSize({ width: 390, height: 844 });
  await blocked.emulateMedia({ colorScheme: "light" });
  await blocked.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  const errors: string[] = [];
  blocked.on("pageerror", (error) => errors.push(error.message));
  await openProfile(blocked);
  await blocked.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(blocked.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    blocked.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    blocked.getByRole("heading", { name: "A little about you." }),
  ).toHaveCSS("color", "rgb(245, 239, 250)");
  expect(
    await blocked.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await blocked.screenshot({
    path: "test-results/dark-login-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await blocked.reload();
  await expect(blocked.locator("html")).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);
});

test("saved theme applies before React loads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("onebody.theme", "dark"));
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(() => document.documentElement.style.colorScheme),
  ).toBe("dark");
});
