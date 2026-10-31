import { test, expect } from "@playwright/test";

test("system default follows live device appearance without writing storage", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "System", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe("rgb(20, 32, 25)");
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
});

test("explicit choice persists, overrides device setting and synchronizes tabs", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#142019",
  );
  const second = await context.newPage();
  await second.emulateMedia({ colorScheme: "light" });
  await second.goto("/register");
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
  await blocked.goto("/login");
  await blocked.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(blocked.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    blocked.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    blocked.getByRole("link", { name: "Create an account" }),
  ).toHaveCSS("color", "rgb(191, 219, 173)");
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
