import { test, expect, type Page } from "@playwright/test";
const key = "onebody.rememberedAccount";
const alice = {
  id: "reader-a",
  name: "Ameh Mathias",
  email: "ameh@example.com",
  role: "member",
  isActive: true,
  avatarUrl: null,
  createdAt: "2026-10-01T12:00:00Z",
};
const beth = {
  ...alice,
  id: "reader-b",
  name: "Beth Reader",
  email: "beth@example.com",
};
async function mockApi(page: Page) {
  let calls = 0;
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().url().endsWith("/auth/login")) {
      calls++;
      const body = route.request().postDataJSON();
      if (body.password === "incorrect")
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: '{"message":"Invalid email or password"}',
        });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          data: {
            user: body.email === beth.email ? beth : alice,
            token: "memory-only-test-token",
          },
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        data: [],
        meta: { page: 1, limit: 9, total: 0, totalPages: 1 },
      }),
    });
  });
  return () => calls;
}
async function submit(page: Page) {
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
async function logout(page: Page) {
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
}

test("opt-in saves only returned name/email and personalizes future visits without restoring a session", async ({
  page,
}) => {
  const calls = await mockApi(page);
  await page.goto("/login");
  await expect(
    page.getByRole("checkbox", { name: "Remember my name on this device" }),
  ).not.toBeChecked();
  await page.getByLabel("Email address").fill(alice.email);
  await page.getByLabel("Password", { exact: true }).fill("StrongPassword123!");
  await page.getByRole("checkbox").check();
  await submit(page);
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key),
  ).toEqual({ name: alice.name, email: alice.email });
  expect(
    await page.evaluate(() => Object.values(localStorage).join(" ")),
  ).not.toContain("StrongPassword123!");
  expect(
    await page.evaluate(() => Object.values(localStorage).join(" ")),
  ).not.toContain("memory-only-test-token");
  await logout(page);
  await expect(
    page.getByRole("heading", { name: "Welcome back, Ameh Mathias." }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(alice.email);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Ameh Mathias." }),
  ).toBeVisible();
  expect(calls()).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("different email hides greeting, failed login preserves identity, unchecked successful login forgets it", async ({
  page,
}) => {
  const calls = await mockApi(page);
  await page.goto("/login");
  await page.evaluate(
    ({ key, alice }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ name: alice.name, email: alice.email }),
      ),
    { key, alice },
  );
  await page.reload();
  await page.getByLabel("Email address").fill(beth.email);
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  expect(calls()).toBe(0);
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Invalid email or password",
  );
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).email,
      key,
    ),
  ).toBe(alice.email);
  await page.getByLabel("Password", { exact: true }).fill("StrongPassword123!");
  await submit(page);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
  await logout(page);
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(beth.email);
  await page.getByLabel("Password", { exact: true }).fill("StrongPassword123!");
  await page.getByRole("checkbox").check();
  await submit(page);
  await logout(page);
  await expect(
    page.getByRole("heading", { name: "Welcome back, Beth Reader." }),
  ).toBeVisible();
});

test("use another account clears identity, email and password while preserving theme", async ({
  page,
}) => {
  await page.goto("/login");
  await page.evaluate(
    ({ key, alice }) => {
      localStorage.setItem(
        key,
        JSON.stringify({ name: alice.name, email: alice.email }),
      );
      localStorage.setItem("onebody.theme", "dark");
    },
    { key, alice },
  );
  await page.reload();
  await page.getByLabel("Password", { exact: true }).fill("temporary");
  await page.getByRole("button", { name: "Show password" }).click();
  await page.getByRole("button", { name: "Use another account" }).click();
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue("");
  await expect(page.getByLabel("Email address")).toBeFocused();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("onebody.theme"))).toBe(
    "dark",
  );
});

test("corrupt identity and unavailable storage do not prevent normal sign-in", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page.evaluate((key) => localStorage.setItem(key, "invalid-json"), key);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  const blocked = await context.newPage();
  await blocked.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"])
      Object.defineProperty(Storage.prototype, method, {
        value: () => {
          throw new DOMException("Blocked", "SecurityError");
        },
      });
  });
  await mockApi(blocked);
  const errors: string[] = [];
  blocked.on("pageerror", (e) => errors.push(e.message));
  await blocked.goto("/login");
  await blocked.getByLabel("Email address").fill(alice.email);
  await blocked
    .getByLabel("Password", { exact: true })
    .fill("StrongPassword123!");
  await blocked.getByRole("checkbox").check();
  await submit(blocked);
  await logout(blocked);
  await expect(
    blocked.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("registration remains generic with blank email and no remember checkbox", async ({
  page,
}) => {
  await page.goto("/login");
  await page.evaluate(
    ({ key, alice }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ name: alice.name, email: alice.email }),
      ),
    { key, alice },
  );
  await page.reload();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(
    page.getByRole("heading", { name: "Let’s grow together." }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue("");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Ameh Mathias." }),
  ).toBeVisible();
});
