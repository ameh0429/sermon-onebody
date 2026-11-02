import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
// @ts-ignore Node test setup only.
import { sequelize } from "../../backend-sermon-api/dist/config/database.js";
// @ts-ignore
import {
  User,
  Sermon,
  StudyPlan,
  DailyLesson,
} from "../../backend-sermon-api/dist/models/index.js";
import bcrypt from "../../backend-sermon-api/node_modules/bcryptjs/index.js";
let user: any, sermon: any, plan: any;
const run = randomUUID(),
  password = "BibleReaderTest123!";
test.beforeAll(async () => {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error("Use a local development database.");
  user = await User.create({
    name: "Bible Reader",
    email: `bible-reader.${run}@example.com`,
    passwordHash: await bcrypt.hash(password, 12),
  });
  sermon = await Sermon.create({
    title: `Scripture message ${run}`,
    preacher: "Pastor",
    passage: "Ephesians 2:1–10",
    sermonDate: "2026-11-02",
    status: "published",
  });
  plan = await StudyPlan.create({
    title: `Scripture plan ${run}`,
    sermonId: sermon.id,
  });
  await DailyLesson.create({
    studyPlanId: plan.id,
    day: 1,
    title: "A verse for today",
    passage: "John 3:16",
    content: "Read and reflect.",
  });
});
test.afterAll(async () => {
  if (plan) await plan.destroy();
  if (sermon) await sermon.destroy();
  if (user) await user.destroy();
  await sequelize.close();
});
async function login(page: any) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A word for your season." }),
  ).toBeVisible();
}
async function spa(page: any, path: string) {
  await page.evaluate((path: string) => {
    history.pushState({}, "", path);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

test("read a real passage, switch translations without changing reference and retain preferences", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Bible", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Genesis 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Previous chapter" }),
  ).toBeDisabled();
  await page.getByLabel("Passage reference").fill("John 3:16");
  await page.getByRole("button", { name: "Read passage", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "John 3:16", exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-verse="16"]')).toContainText(
    "For God so loved",
  );
  await page.getByLabel("Bible translation").selectOption("ylt");
  await expect(page.locator('[data-verse="16"]')).toContainText(
    "for God did so love",
  );
  await expect(
    page.getByRole("heading", { name: "John 3:16", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Young’s Literal Translation (1898). Public domain.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.locator("#bible-font").fill("24");
  await expect(page.locator(".bible-text")).toHaveCSS("font-size", "24px");
  await page.getByRole("button", { name: "Read whole chapter" }).click();
  await expect(
    page.getByRole("heading", { name: "John 3", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-verse]")).toHaveCount(36);
  await page.getByRole("button", { name: "Next chapter", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "John 4", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Previous chapter", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "John 3", exact: true }),
  ).toBeVisible();
  await spa(page, "/sermons");
  await spa(page, "/bible");
  await expect(page.getByLabel("Bible translation")).toHaveValue("ylt");
  await expect(page.locator(".bible-text")).toHaveCSS("font-size", "24px");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("onebody.bible.translation"),
    ),
  ).toBe("ylt");
  expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual([
    "onebody.bible.fontSize",
    "onebody.bible.translation",
  ]);
});

test("sermon and lesson links open exact references with a manual fallback for complex passages", async ({
  page,
}) => {
  await login(page);
  await spa(page, `/sermons/${sermon.id}`);
  await page
    .getByRole("link", { name: "Read passage in Bible", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ephesians 2:1–10", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-verse]")).toHaveCount(10);
  await spa(page, `/growth/${plan.id}`);
  await page
    .getByRole("link", { name: "Read passage in Bible", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "John 3:16", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Passage reference").fill("John 3:16-4:2");
  await page.getByRole("button", { name: "Read passage", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("one chapter");
  await page.getByLabel("Bible book").selectOption("JHN");
  await page.getByLabel("Bible chapter").selectOption("5");
  await expect(
    page.getByRole("heading", { name: "John 5", exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-verse="4"]')).toContainText(
    "Verse text is not present in this edition.",
  );
});

test("book boundaries, mobile/tablet layouts, More navigation and dark mode", async ({
  page,
}) => {
  await login(page);
  await spa(page, "/bible?book=GEN&chapter=50");
  await expect(
    page.getByRole("heading", { name: "Genesis 50", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next chapter" }).click();
  await expect(
    page.getByRole("heading", { name: "Exodus 1", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Bible book").selectOption("REV");
  await page.getByLabel("Bible chapter").selectOption("22");
  await expect(
    page.getByRole("heading", { name: "Revelation 22", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next chapter" }),
  ).toBeDisabled();
  await page.emulateMedia({ colorScheme: "dark" });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/bible-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const nav = page.getByRole("navigation", {
    name: "Mobile navigation",
    exact: true,
  });
  await expect(nav.getByRole("link")).toHaveCount(5);
  await nav.getByRole("link", { name: "More", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Private journal", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "More navigation", exact: true })
    .getByRole("link", { name: "My profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little about you." }),
  ).toBeVisible();
});

test("blocked preference storage and server failures do not crash reader", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await spa(page, "/bible");
  await expect(
    page.getByRole("heading", { name: "Genesis 1", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Bible translation").selectOption("ylt");
  await expect(
    page.getByText("Young’s Literal Translation (1898). Public domain.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.route("**/bible/passages?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"message":"Bible text is temporarily unavailable."}',
    }),
  );
  await page.getByRole("button", { name: "Next chapter" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await page.unroute("**/bible/passages?*");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Genesis 2", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("YouVersion display includes attribution, required styles, theme and size; removes styles on fallback", async ({
  page,
}) => {
  await login(page);
  const translation = {
    id: "yv-9876",
    name: "Test Licensed Edition",
    abbreviation: "TEST",
    attribution: "Current test publisher attribution",
    sourceUrl: "https://www.bible.com/versions/9876",
    licence: "YouVersion publisher license",
  };
  await page.route("https://cdn.youversion.com/platform/1/bible.css", (route) =>
    route.fulfill({
      contentType: "text/css",
      body: '[data-slot="yv-bible-renderer"] {font-size:var(--yv-reader-font-size);line-height:var(--yv-reader-line-height)}',
    }),
  );
  await page.route(
    "https://api.youversion.com/v1/fonts/1/stylesheet?*",
    (route) => route.fulfill({ contentType: "text/css", body: "" }),
  );
  await page.route("**/api/v1/bible/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/translations"))
      return route.fulfill({
        json: {
          status: "success",
          data: [
            {
              ...translation,
              id: "asv",
              name: "American Standard Version (1901)",
            },
            translation,
          ],
        },
      });
    if (url.searchParams.get("translationId") !== "yv-9876")
      return route.continue();
    if (url.pathname.endsWith("/books"))
      return route.fulfill({
        json: {
          status: "success",
          data: [{ id: "JHN", name: "John", chapters: 2 }],
        },
      });
    return route.fulfill({
      json: {
        status: "success",
        data: {
          translation,
          book: { id: "JHN", name: "John" },
          chapter: 1,
          reference: "John 1:1",
          fromVerse: 1,
          toVerse: 1,
          verses: [],
          previous: null,
          next: { bookId: "JHN", chapter: 2 },
          display: {
            html: '<p class="yv-v" v="1">Invented licensed fixture text.</p>',
            containerAttributes: {
              "data-yv-sdk": "",
              "data-slot": "yv-bible-renderer",
            },
            stylesheets: [
              {
                kind: "bible",
                rel: "stylesheet",
                href: "https://cdn.youversion.com/platform/1/bible.css",
              },
              {
                kind: "font",
                rel: "stylesheet",
                href: "https://api.youversion.com/v1/fonts/1/stylesheet?app_key=test-key",
              },
            ],
          },
        },
      },
    });
  });
  await spa(page, "/bible?translation=yv-9876&reference=John%201:1");
  const text = page.locator('[data-slot="yv-bible-renderer"]');
  await expect(text).toContainText("Invented licensed fixture text.");
  await expect(
    page.getByText("Current test publisher attribution", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("head link[data-yv-stylesheet]")).toHaveCount(2);
  await page.getByLabel("Text size:").fill("24");
  await expect(text).toHaveCSS("font-size", "24px");
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(text).toHaveAttribute("data-yv-theme", "dark");
  await page.getByLabel("Bible translation").selectOption("asv");
  await expect(page.locator('[data-verse="1"]')).toBeVisible();
  await expect(page.locator("head link[data-yv-stylesheet]")).toHaveCount(0);
  await expect(
    page.getByText("Current test publisher attribution", { exact: true }),
  ).toHaveCount(0);
});

test("provider catalog warning preserves local reader", async ({ page }) => {
  await login(page);
  await page.route("**/api/v1/bible/translations", (route) =>
    route.fulfill({
      json: {
        status: "success",
        data: [
          {
            id: "asv",
            name: "American Standard Version (1901)",
            abbreviation: "ASV",
          },
        ],
        warning:
          "YouVersion translations could not be loaded. ASV and YLT remain available.",
      },
    }),
  );
  await spa(page, "/bible");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "YouVersion translations could not be loaded" }),
  ).toContainText("ASV and YLT remain available.");
  await expect(page.locator('[data-verse="1"]')).toBeVisible();
});
