import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
// @ts-ignore Backend fixtures are compiled by webServer.
import { sequelize } from "../../backend-sermon-api/dist/config/database.js";
// @ts-ignore
import {
  User,
  Sermon,
  StudyPlan,
  FellowshipGroup,
  GroupMember,
  DiscussionPost,
} from "../../backend-sermon-api/dist/models/index.js";
// @ts-ignore
import { signToken } from "../../backend-sermon-api/dist/middleware/auth.js";
import bcrypt from "../../backend-sermon-api/node_modules/bcryptjs/index.js";
const run = randomUUID(),
  password = "NotificationsTest123!";
let reader: any, leader: any, sermon: any, plan: any, group: any, parent: any;
const ids: string[] = [];
const headers = (user: any) => ({
  authorization: `Bearer ${signToken({ id: user.id, role: user.role })}`,
});
test.beforeAll(async ({ request }) => {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error("Local DB required");
  reader = await User.create({
    name: "Notice Reader",
    email: `notices.${run}@example.com`,
    passwordHash: await bcrypt.hash(password, 12),
  });
  leader = await User.create({
    name: "Notice Leader",
    email: `notice-leader.${run}@example.com`,
    passwordHash: "not-a-login",
    role: "leader",
  });
  const s = await request.post("/api/v1/sermons", {
    headers: headers(leader),
    data: {
      title: `New message ${run}`,
      preacher: "Pastor",
      passage: "John 1",
      sermonDate: "2026-11-02",
      status: "published",
    },
  });
  expect(s.status()).toBe(201);
  sermon = (await s.json()).data;
  ids.push(sermon.id);
  const p = await request.post("/api/v1/study-plans", {
    headers: headers(leader),
    data: {
      title: `New study ${run}`,
      sermonId: sermon.id,
      dailyLessons: [{ day: 1, title: "First day", content: "Reflect." }],
    },
  });
  expect(p.status()).toBe(201);
  plan = (await p.json()).data;
  group = await FellowshipGroup.create({
    name: `Notice group ${run}`,
    leaderId: leader.id,
  });
  await GroupMember.create({ groupId: group.id, userId: reader.id });
  parent = await DiscussionPost.create({
    groupId: group.id,
    authorId: reader.id,
    content: `Original discussion ${run}`,
  });
  for (let i = 0; i < 12; i++)
    await DiscussionPost.create({
      groupId: group.id,
      authorId: leader.id,
      content: `Newer thread ${i}`,
    });
  const r = await request.post(`/api/v1/groups/${group.id}/posts`, {
    headers: headers(leader),
    data: { parentPostId: parent.id, content: "Reply for you." },
  });
  expect(r.status()).toBe(201);
});
test.afterAll(async () => {
  if (plan) await StudyPlan.destroy({ where: { id: plan.id } });
  if (ids.length) await Sermon.destroy({ where: { id: ids } });
  if (group) await group.destroy();
  if (reader) await reader.destroy();
  if (leader) await leader.destroy();
  await sequelize.close();
});
async function login(page: any) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(reader.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A word for your season." }),
  ).toBeVisible();
}
test("desktop bell, unread inbox, read actions and exact discussion deep link", async ({
  page,
}) => {
  await login(page);
  await page
    .locator(".desktop-header")
    .getByRole("link", { name: "Notifications, 3 unread", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Notifications.", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Your notifications" })
      .getByRole("listitem"),
  ).toHaveCount(3);
  await page
    .getByRole("link", { name: /Someone replied to your fellowship post/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`thread=${parent.id}`));
  await expect(
    page.getByText(`Original discussion ${run}`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Reply for you.", { exact: true })).toBeVisible();
  await page
    .locator(".desktop-header")
    .getByRole("link", { name: /Notifications/ })
    .click();
  await page.getByLabel("Unread only", { exact: true }).check();
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Mark all as read", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "You’re all caught up." }),
  ).toBeVisible();
  await expect(
    page
      .locator(".desktop-header")
      .getByRole("link", { name: "Notifications", exact: true }),
  ).toBeVisible();
});
test("mobile inbox and saved preferences suppress future events", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page
    .locator(".mobile-header")
    .getByRole("link", { name: "Notifications", exact: true })
    .click();
  await page.getByLabel("New sermons", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Notification preferences saved." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("New sermons", { exact: true }),
  ).not.toBeChecked();
  const response = await request.post("/api/v1/sermons", {
    headers: headers(leader),
    data: {
      title: `Opted out ${run}`,
      preacher: "Pastor",
      passage: "John 1",
      sermonDate: "2026-11-02",
      status: "published",
    },
  });
  expect(response.status()).toBe(201);
  const s = (await response.json()).data;
  ids.push(s.id);
  await page.reload();
  await expect(
    page.getByText(`New sermon: Opted out ${run}`, { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
