import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
// @ts-ignore The backend is compiled by Playwright's web server startup.
import { sequelize } from "../../backend-sermon-api/dist/config/database.js";
// @ts-ignore
import {
  User,
  Sermon,
  StudyPlan,
  DailyLesson,
  LessonProgress,
} from "../../backend-sermon-api/dist/models/index.js";
import bcrypt from "../../backend-sermon-api/node_modules/bcryptjs/index.js";
const run = randomUUID();
const memberEmail = `reader.${run}@example.com`,
  registeredEmail = `new.${run}@example.com`;
const password = "TestMemberPass123!";
let sermon: any, plan: any, member: any;
const errors: string[] = [];
test.beforeAll(async () => {
  if (
    !["127.0.0.1", "localhost"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error(
      "Run browser tests against a local development database only.",
    );
  member = await User.create({
    name: "Ada Reader",
    email: memberEmail,
    passwordHash: await bcrypt.hash(password, 12),
  });
  sermon = await Sermon.create({
    title: `Rooted in Grace ${run}`,
    preacher: "Pastor Ada",
    passage: "Ephesians 2:1-10",
    sermonDate: "2026-10-25",
    summary: "A gift to carry into every day.",
    content:
      "We grow by grace.\n\nTake a moment to reflect on the gift of faith.",
    audioUrl: "https://media.example.com/sermon.wav",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    tags: [`e2e-${run}`, "grace"],
  });
  plan = await StudyPlan.create({
    title: `Grace for the Week ${run}`,
    sermonId: sermon.id,
    description: "A steady rhythm of reading and reflection.",
  });
  await DailyLesson.bulkCreate([
    {
      studyPlanId: plan.id,
      day: 1,
      title: "Receive the gift",
      passage: "Ephesians 2:8",
      content: "Read slowly. What does grace mean in your life today?",
    },
    {
      studyPlanId: plan.id,
      day: 3,
      title: "Walk in kindness",
      passage: "Ephesians 2:10",
      content: "Choose one act of kindness today.",
    },
  ]);
});
test.afterAll(async () => {
  if (plan) await StudyPlan.destroy({ where: { id: plan.id } });
  if (sermon) await Sermon.destroy({ where: { id: sermon.id } });
  await User.destroy({ where: { email: [memberEmail, registeredEmail] } });
  await sequelize.close();
});
async function signIn(page: any) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(memberEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A word for your season." }),
  ).toBeVisible();
}
test("member journey: login, filters, media, lessons, saved progress and profile", async ({
  page,
}) => {
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Preacher", { exact: true }).fill("Pastor Ada");
  await page.getByLabel("Tag", { exact: true }).fill(`e2e-${run}`);
  await page.getByRole("button", { name: "Apply search & filters" }).click();
  await expect(
    page.getByRole("heading", { name: sermon.title, exact: true }),
  ).toBeVisible();
  const wav = Buffer.alloc(44 + 16000);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(16000, 40);
  await page.route("https://media.example.com/sermon.wav", (route) =>
    route.fulfill({ contentType: "audio/wav", body: wav }),
  );
  await page.getByRole("heading", { name: sermon.title, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: sermon.title, exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.locator("audio")).toHaveAttribute("src", sermon.audioUrl);
  await page.locator("audio").evaluate(async (audio: HTMLAudioElement) => {
    await audio.play();
  });
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0);
  await page
    .locator("audio")
    .evaluate((audio: HTMLAudioElement) => audio.pause());
  await page.getByRole("button", { name: "Video", exact: true }).click();
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  await page.getByRole("link", { name: plan.title }).click();
  await expect(
    page.getByRole("heading", { name: "Receive the gift" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark lesson complete", exact: true })
    .click();
  await expect(
    page.getByText("1 of 2 lessons completed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "50");
  const stored = await LessonProgress.findOne({
    where: { userId: member.id, completed: true },
  });
  expect(stored).not.toBeNull();
  await page.getByRole("button", { name: "Next lesson" }).click();
  await expect(
    page.getByRole("heading", { name: "Walk in kindness" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Day 1/ }).click();
  await expect(
    page.getByRole("button", { name: "Mark incomplete" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Mark incomplete" }).click();
  await expect(
    page.getByText("0 of 2 lessons completed", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "My profile" })
    .click();
  await expect(page.getByText(memberEmail, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Refresh profile" }).click();
  await expect(page.getByText("Your profile is up to date.")).toBeVisible();
  await page.getByRole("button", { name: "Install OneBody" }).click();
  await expect(page.getByText(/On iPhone, open in Safari/)).toBeVisible();
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("registration, responsive layouts and in-memory session protection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register");
  await page.getByLabel("Full name").fill("New Reader");
  await page.getByLabel("Email address").fill(registeredEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A word for your season." }),
  ).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const nav = page.getByRole("navigation", {
      name: width < 1024 ? "Mobile navigation" : "Main navigation",
      exact: true,
    });
    await nav
      .getByRole("link", {
        name: width < 1024 ? "Growth" : "Weekly growth",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Small steps. Deeper roots." }),
    ).toBeVisible();
    await page.getByLabel("Search study plans").fill("Grace for the Week");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("heading", { name: plan.title }).click();
    await expect(
      page.getByRole("heading", { name: "Receive the gift" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/weekly-growth-${width}.png`,
      fullPage: true,
    });
    await nav
      .getByRole("link", {
        name: width < 1024 ? "Sermons" : "Sermon library",
        exact: true,
      })
      .click();
  }
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
});
test("failed login, empty search, lesson save failure and expired authentication", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(memberEmail);
  await page.getByLabel("Password", { exact: true }).fill("IncorrectPassword!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Invalid email or password",
  );
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A word for your season." }),
  ).toBeVisible();
  await page
    .getByLabel("Search sermons", { exact: true })
    .fill(`no-matching-sermon-${run}`);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No messages found." }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Weekly growth" })
    .click();
  await page.getByLabel("Search study plans").fill("Grace for the Week");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("heading", { name: plan.title }).click();
  await expect(
    page.getByRole("button", { name: "Mark lesson complete", exact: true }),
  ).toBeEnabled();
  await page.route("**/daily-lessons/*/progress", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        status: "error",
        message: "Temporarily unavailable. Try again.",
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Mark lesson complete", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Temporarily unavailable",
  );
  await expect(
    page.getByText("0 of 2 lessons completed", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/daily-lessons/*/progress");
  await page
    .getByRole("button", { name: "Mark lesson complete", exact: true })
    .click();
  await expect(
    page.getByText("1 of 2 lessons completed", { exact: true }),
  ).toBeVisible();
  await page.route("**/users/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: '{"message":"Token expired"}',
    }),
  );
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "My profile" })
    .click();
  await page.getByRole("button", { name: "Refresh profile" }).click();
  await expect(
    page.getByText("Your session ended. Please sign in again."),
  ).toBeVisible();
});
test("published plan catalog is paginated and excludes draft, archived and unattached plans", async ({
  request,
}) => {
  const auth = await request.post("/api/v1/auth/login", {
    data: { email: memberEmail, password },
  });
  expect(auth.ok()).toBeTruthy();
  const token = (await auth.json()).data.token;
  const headers = { authorization: `Bearer ${token}` };
  const hiddenSermon = await Sermon.create({
    title: "Hidden",
    preacher: "Test",
    passage: "John 1",
    sermonDate: "2026-10-25",
    status: "draft",
  });
  const hiddenPlans = await StudyPlan.bulkCreate([
    { title: `Hidden ${run}`, sermonId: hiddenSermon.id },
    { title: `Unattached ${run}` },
  ]);
  try {
    const list = await request.get(`/api/v1/study-plans?q=${run}&limit=1`, {
      headers,
    });
    const body = await list.json();
    expect(body.data.map((p: any) => p.id)).toEqual([plan.id]);
    expect(body.meta.total).toBe(1);
    expect(body.data[0].sermon.title).toBe(sermon.title);
    await hiddenSermon.update({ status: "archived" });
    const archived = await request.get(`/api/v1/study-plans?q=${run}`, {
      headers,
    });
    expect((await archived.json()).meta.total).toBe(1);
    expect(
      (
        await request.get("/api/v1/study-plans?limit=101", { headers })
      ).status(),
    ).toBe(400);
    expect((await request.get("/api/v1/study-plans")).status()).toBe(401);
  } finally {
    await StudyPlan.destroy({
      where: { id: hiddenPlans.map((p: any) => p.id) },
    });
    await hiddenSermon.destroy();
  }
});
test("PWA manifest, service worker and offline application shell", async ({
  page,
  request,
  context,
}) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(2);
  await page.goto("/login");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  await expect(page.getByText(/You’re offline/)).toBeVisible();
  await context.setOffline(false);
});

test("native video playback and unavailable audio feedback", async ({
  page,
}) => {
  const previous = sermon.videoUrl;
  await sermon.update({ videoUrl: "https://media.example.com/sermon.webm" });
  try {
    await page.route("https://media.example.com/sermon.wav", (route) =>
      route.abort(),
    );
    const clip = await readFile(
      new URL("./fixtures/sermon.webm", import.meta.url),
    );
    await page.route("https://media.example.com/sermon.webm", (route) =>
      route.fulfill({ contentType: "video/webm", body: clip }),
    );
    await signIn(page);
    await page.getByLabel("Search sermons", { exact: true }).fill(run);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page
      .getByRole("heading", { name: sermon.title, exact: true })
      .click();
    await expect(
      page.getByText(/This audio could not be played/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Video", exact: true }).click();
    await page.locator("video").evaluate(async (video: HTMLVideoElement) => {
      await video.play();
    });
    await expect
      .poll(() =>
        page
          .locator("video")
          .evaluate((video: HTMLVideoElement) => video.currentTime),
      )
      .toBeGreaterThan(0);
    await page
      .locator("video")
      .evaluate((video: HTMLVideoElement) => video.pause());
  } finally {
    await sermon.update({ videoUrl: previous });
  }
});
