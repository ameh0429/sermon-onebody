import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
// Backend imports are used only by the Node test runner to seed and remove local fixtures.
// @ts-ignore
import { sequelize } from "../../backend-sermon-api/dist/config/database.js";
// @ts-ignore
import {
  User,
  Sermon,
  StudyPlan,
  DailyLesson,
  FellowshipGroup,
  GroupMember,
  DiscussionPost,
  JournalEntry,
  Bookmark,
} from "../../backend-sermon-api/dist/models/index.js";
// @ts-ignore
import { signToken } from "../../backend-sermon-api/dist/middleware/auth.js";
import bcrypt from "../../backend-sermon-api/node_modules/bcryptjs/index.js";
const run = randomUUID(),
  password = "CommunityTests123!";
let member: any,
  other: any,
  pastor: any,
  admin: any,
  sermon: any,
  group: any,
  reportedPost: any,
  draft: any;
const users: any[] = [];
async function signIn(page: any, user: any) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await spa(page, "/sermons");
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
const headers = (user: any) => ({
  authorization: `Bearer ${signToken({ id: user.id, role: user.role })}`,
});
test.beforeAll(async () => {
  if (
    !["127.0.0.1", "localhost"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error("Use a local development database.");
  for (const role of ["member", "member", "leader", "admin"])
    users.push(
      await User.create({
        name: `Test ${role} ${users.length}`,
        email: `community-${users.length}.${run}@example.com`,
        role,
        passwordHash: await bcrypt.hash(password, 12),
      }),
    );
  [member, other, pastor, admin] = users;
  sermon = await Sermon.create({
    title: `Community message ${run}`,
    preacher: "Pastor Ada",
    passage: "John 1",
    sermonDate: "2026-10-25",
    status: "published",
    tags: ["community"],
  });
  draft = await Sermon.create({
    title: `Draft message ${run}`,
    preacher: "Pastor Ada",
    passage: "John 2",
    sermonDate: "2026-10-25",
    status: "draft",
  });
  await StudyPlan.create({ title: `Unattached ${run}` });
  group = await FellowshipGroup.create({
    name: `Fellowship ${run}`,
    description: "Growing in faith together.",
    leaderId: pastor.id,
  });
  await GroupMember.create({
    groupId: group.id,
    userId: pastor.id,
    role: "leader",
  });
  await GroupMember.create({
    groupId: group.id,
    userId: other.id,
    role: "member",
  });
  reportedPost = await DiscussionPost.create({
    groupId: group.id,
    authorId: other.id,
    content: `Please review this ${run}`,
    isFlagged: true,
    flagReason: "Review requested",
  });
});
test.afterAll(async () => {
  const { default: pkg } =
    await import("../../backend-sermon-api/node_modules/sequelize/lib/index.js");
  const { Op } = pkg;
  await StudyPlan.destroy({ where: { title: { [Op.like]: `%${run}%` } } });
  await FellowshipGroup.destroy({ where: { name: { [Op.like]: `%${run}%` } } });
  await Sermon.destroy({ where: { title: { [Op.like]: `%${run}%` } } });
  await User.destroy({ where: { id: users.map((u) => u.id) } });
  await sequelize.close();
});
test("bookmarks and private journal create, edit, failed save, privacy and delete", async ({
  page,
  request,
}) => {
  await signIn(page, member);
  await spa(page, `/sermons/${sermon.id}`);
  await page
    .getByRole("button", { name: "Bookmark sermon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove bookmark", exact: true }),
  ).toBeVisible();
  expect(
    await Bookmark.count({ where: { userId: member.id, sermonId: sermon.id } }),
  ).toBe(1);
  await spa(page, "/personal");
  await expect(
    page.getByRole("link", { name: sermon.title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove bookmark", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A place for your saved messages." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Private journal", exact: true })
    .click();
  await page.getByRole("link", { name: "New reflection" }).click();
  await page.getByLabel("Reflection title").fill(`Private reflection ${run}`);
  await page.getByLabel("Your reflection").fill("This is a private prayer.");
  await page.getByRole("button", { name: "Save reflection" }).click();
  await page
    .getByRole("heading", { name: `Private reflection ${run}` })
    .click();
  const entry = await JournalEntry.findOne({
    where: { title: `Private reflection ${run}` },
  });
  expect(entry.isShared).toBe(false);
  expect(
    (
      await request.get(`/api/v1/journal/${entry.id}`, {
        headers: headers(other),
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.get(`/api/v1/journal/${entry.id}`, {
        headers: headers(admin),
      })
    ).status(),
  ).toBe(404);
  await page.getByLabel("Your reflection").fill("Updated private prayer.");
  await page.route("**/api/v1/journal/*", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"message":"Save temporarily unavailable"}',
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Save reflection" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Save temporarily unavailable",
  );
  await expect(page.getByLabel("Your reflection")).toHaveValue(
    "Updated private prayer.",
  );
  await page.unroute("**/api/v1/journal/*");
  await page.getByRole("button", { name: "Save reflection" }).click();
  await page
    .getByRole("heading", { name: `Private reflection ${run}` })
    .click();
  await expect(page.getByLabel("Your reflection")).toHaveValue(
    "Updated private prayer.",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete reflection" }).click();
  await expect(
    page.getByRole("heading", { name: "Start with a thought." }),
  ).toBeVisible();
});
test("join a group, discussion and reply, reporting, member list, leave revokes access", async ({
  page,
  request,
}) => {
  await signIn(page, member);
  await spa(page, `/groups/${group.id}`);
  await expect(
    page.getByRole("heading", { name: "A conversation is waiting." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Join group", exact: true }).click();
  await page
    .getByLabel("Share with your group")
    .fill(`A new discussion ${run}`);
  await page
    .getByRole("button", { name: "Post discussion", exact: true })
    .click();
  const article = page
    .getByRole("article")
    .filter({ hasText: `A new discussion ${run}` });
  await article.getByRole("button", { name: "Reply", exact: true }).click();
  await article.getByLabel("Your reply").fill("A thoughtful reply.");
  await article
    .getByRole("button", { name: "Post reply", exact: true })
    .click();
  await expect(
    article.getByText("A thoughtful reply.", { exact: true }),
  ).toBeVisible();
  const report = page
    .getByRole("article")
    .filter({ hasText: `Please review this ${run}` });
  await report.getByRole("button", { name: "Report post" }).click();
  await report
    .getByLabel("Reason for reporting")
    .fill("Off-topic test discussion");
  await report.getByRole("button", { name: "Send report" }).click();
  await page.getByRole("button", { name: "Members", exact: true }).click();
  await expect(page.getByRole("main").getByText(member.name, { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Leave group", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A conversation is waiting." }),
  ).toBeVisible();
  expect(
    (
      await request.get(`/api/v1/groups/${group.id}/posts`, {
        headers: headers(member),
      })
    ).status(),
  ).toBe(403);
});
test("pastor manages sermons, plans and lessons and sees analytics", async ({
  page,
  request,
}) => {
  await signIn(page, pastor);
  await spa(page, "/profile");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await spa(page, "/dashboard");
  await page.screenshot({
    path: "test-results/dark-dashboard.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("heading", { name: "Care for a growing community." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Manage sermons", exact: true }).click();
  await page.getByRole("link", { name: "New sermon" }).click();
  await page.getByLabel("Sermon title").fill(`Created message ${run}`);
  await page.getByLabel("Preacher", { exact: true }).fill("Pastor Test");
  await page.getByLabel("Scripture passage").fill("Romans 8");
  await page.getByLabel("Sermon date").fill("2026-10-31");
  await page.getByLabel("Publication status").selectOption("published");
  await page.getByRole("button", { name: "Save sermon", exact: true }).click();
  await page
    .getByLabel("Search", { exact: true })
    .fill(`Created message ${run}`);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        name: `Created message ${run}`,
        exact: true,
      }),
    })
    .getByRole("link", { name: "Edit sermon", exact: true })
    .click();
  await page.getByLabel("Summary", { exact: true }).fill("An edited summary.");
  await page.getByRole("button", { name: "Save sermon", exact: true }).click();
  await page
    .getByLabel("Search", { exact: true })
    .fill(`Created message ${run}`);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        name: `Created message ${run}`,
        exact: true,
      }),
    })
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(page.getByText("archived", { exact: true })).toBeVisible();
  await spa(page, "/dashboard/plans");
  await page.getByLabel("Search", { exact: true }).fill(`Unattached ${run}`);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `Unattached ${run}` }),
  ).toBeVisible();
  await page.getByRole("link", { name: "New study plan" }).click();
  await page.getByLabel("Plan title").fill(`Created plan ${run}`);
  await page.getByLabel("First lesson title").fill("A first step");
  await page.getByLabel("First lesson content").fill("Read Romans 8.");
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The daily lessons" }),
  ).toBeVisible();
  await page
    .getByLabel("Find a sermon", { exact: true })
    .fill(`Community message ${run}`);
  await page
    .getByLabel("Select sermon", { exact: true })
    .selectOption(sermon.id);
  await page.getByRole("button", { name: "Save attachment" }).click();
  await expect(page.getByText("Sermon attachment saved.")).toBeVisible();
  const add = page.locator("form").filter({
    has: page.getByRole("heading", {
      name: "Add a daily lesson",
      exact: true,
    }),
  });
  await add.getByLabel("Day number").fill("2");
  await add.getByLabel("Lesson title", { exact: true }).fill("Another step");
  await add
    .getByLabel("Lesson content", { exact: true })
    .fill("Reflect and pray.");
  await add.getByRole("button", { name: "Add lesson", exact: true }).click();
  const second = page.locator("form").filter({
    has: page.getByRole("heading", {
      name: "Day 2: Another step",
      exact: true,
    }),
  });
  await second
    .getByLabel("Lesson content", { exact: true })
    .fill("Edited lesson content.");
  await second
    .getByRole("button", { name: "Save lesson", exact: true })
    .click();
  await expect(second.getByText("Lesson saved.")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await second.getByRole("button", { name: "Delete lesson" }).click();
  await expect(
    page.getByRole("heading", { name: "Day 2: Another step" }),
  ).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Give the message room to grow." }),
  ).toBeVisible();
  expect(
    (
      await request.get("/api/v1/study-plans?scope=manage", {
        headers: headers(member),
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.get("/api/v1/admin/users", { headers: headers(pastor) })
    ).status(),
  ).toBe(403);
});
test("admin assigns roles, deactivates/reactivates accounts; member route guard", async ({
  page,
  request,
}) => {
  await signIn(page, admin);
  await spa(page, "/dashboard/users");
  const card = page
    .getByRole("article")
    .filter({ has: page.getByText(other.email, { exact: true }) });
  await card.getByLabel(`Role for ${other.name}`).selectOption("leader");
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Apply role" }).click();
  await expect(card.getByLabel(`Role for ${other.name}`)).toHaveValue("leader");
  await expect
    .poll(async () => (await User.findByPk(other.id)).role)
    .toBe("leader");
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(card.getByText("Inactive", { exact: true })).toBeVisible();
  expect(
    (
      await request.get("/api/v1/users/me", { headers: headers(other) })
    ).status(),
  ).toBe(401);
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Reactivate", exact: true }).click();
  await expect(card.getByText("Active", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/account-management-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "My profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .last()
    .click();
  await signIn(page, member);
  await spa(page, "/dashboard");
  await expect(
    page.getByRole("heading", { name: "This space is for your leaders." }),
  ).toBeVisible();
  expect(
    (
      await request.patch(`/api/v1/admin/users/${other.id}/role`, {
        headers: headers(member),
        data: { role: "admin" },
      })
    ).status(),
  ).toBe(403);
});
test("group leader reviews reported posts and creates, edits and deletes a group", async ({
  page,
}) => {
  await reportedPost.reload();
  await reportedPost.update({
    isFlagged: true,
    flagReason: "Review requested",
  });
  await signIn(page, pastor);
  await spa(page, `/groups/${group.id}`);
  await page
    .getByRole("button", { name: "Flagged posts", exact: true })
    .click();
  await expect(
    page.getByText("Review requested", { exact: false }),
  ).toBeVisible();
  const post = page
    .getByRole("article")
    .filter({ hasText: `Please review this ${run}` });
  page.once("dialog", (dialog) => dialog.accept());
  await post.getByRole("button", { name: "Delete post", exact: true }).click();
  await expect(
    page.getByText(`Please review this ${run}`, { exact: true }),
  ).toHaveCount(0);
  await spa(page, "/groups/new");
  await page.getByLabel("Group name").fill(`Created group ${run}`);
  await page
    .getByLabel("Description", { exact: true })
    .fill("A friendly group.");
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await page.getByRole("link", { name: "Manage group" }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("An updated description.");
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(
    page.getByText("An updated description.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Manage group" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete group", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "We grow better together." }),
  ).toBeVisible();
});

test("unpublished bookmarks stay private and staff catalog scope is protected", async ({
  request,
}) => {
  const saved = await Bookmark.create({
    userId: member.id,
    sermonId: draft.id,
  });
  try {
    const list = await request.get(`/api/v1/bookmarks?sermonId=${draft.id}`, {
      headers: headers(member),
    });
    expect(list.status()).toBe(200);
    expect((await list.json()).data).toEqual([]);
    expect(
      (
        await request.post("/api/v1/bookmarks", {
          headers: headers(member),
          data: { sermonId: draft.id },
        })
      ).status(),
    ).toBe(404);
    const manage = await request.get(
      `/api/v1/study-plans?scope=manage&q=${run}`,
      { headers: headers(pastor) },
    );
    expect(manage.status()).toBe(200);
    expect(
      (await manage.json()).data.some(
        (p: any) => p.title === `Unattached ${run}`,
      ),
    ).toBe(true);
    expect(
      (
        await request.get("/api/v1/study-plans?scope=manage", {
          headers: headers(member),
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.get("/api/v1/bookmarks?sermonId=invalid", {
          headers: headers(member),
        })
      ).status(),
    ).toBe(400);
  } finally {
    await saved.destroy();
  }
});
