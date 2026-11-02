import { test, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../dist/app.js";
import { sequelize } from "../dist/config/database.js";
import {
  User,
  Sermon,
  StudyPlan,
  Notification,
  FellowshipGroup,
  GroupMember,
  DiscussionPost,
} from "../dist/models/index.js";
import { signToken } from "../dist/middleware/auth.js";
if (
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error("Local DB required");
const users = [];
for (const role of ["leader", "member", "member", "member"])
  users.push(
    await User.create({
      name: "Notification Test",
      email: `notice.${crypto.randomUUID()}@example.com`,
      passwordHash: "no-login",
      role,
    }),
  );
const [leader, reader, writer, outsider] = users;
const sermons = [],
  plans = [],
  groups = [];
const server = createApp().listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}/api/v1`;
async function request(user, path, method = "GET", body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(user
        ? {
            authorization: `Bearer ${signToken({ id: user.id, role: user.role })}`,
          }
        : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}
async function createSermon(status = "draft") {
  const r = await request(leader, "/sermons", "POST", {
    title: "Notification sermon",
    preacher: "Pastor",
    passage: "John 1",
    sermonDate: "2026-11-02",
    status,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  sermons.push(r.body.data.id);
  return r.body.data;
}
async function createPlan(sermonId) {
  const r = await request(leader, "/study-plans", "POST", {
    title: "Notification plan",
    ...(sermonId ? { sermonId } : {}),
    dailyLessons: [{ day: 1, title: "Day One", content: "Reflect." }],
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  plans.push(r.body.data.id);
  return r.body.data;
}
after(async () => {
  await StudyPlan.destroy({ where: { id: plans } });
  await Sermon.destroy({ where: { id: sermons } });
  await FellowshipGroup.destroy({ where: { id: groups } });
  await User.destroy({ where: { id: users.map((u) => u.id) } });
  await new Promise((r) => server.close(r));
  await sequelize.close();
});
let published, notice, replyNotice, group, parent;
test("authentication, default preferences and no-store responses", async () => {
  assert.equal((await request(null, "/notifications")).status, 401);
  const r = await request(reader, "/notifications/preferences");
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(r.body.data, { sermons: true, plans: true, replies: true });
});
test("drafts do not notify; publication notifies once and excludes actor", async () => {
  published = await createSermon();
  assert.equal(await Notification.count({ where: { userId: reader.id } }), 0);
  assert.equal(
    (
      await request(leader, `/sermons/${published.id}`, "PATCH", {
        status: "published",
      })
    ).status,
    200,
  );
  assert.equal(await Notification.count({ where: { userId: reader.id } }), 1);
  assert.equal(await Notification.count({ where: { userId: leader.id } }), 0);
  for (const body of [
    { title: "Edited sermon" },
    { status: "draft" },
    { status: "published" },
  ])
    assert.equal(
      (await request(leader, `/sermons/${published.id}`, "PATCH", body)).status,
      200,
    );
  assert.equal(await Notification.count({ where: { userId: reader.id } }), 1);
  notice = (await request(reader, "/notifications")).body.data[0];
  assert.equal(notice.target, `/sermons/${published.id}`);
});
test("plans notify when publicly available, including attachment and draft publication", async () => {
  const draft = await createSermon();
  await createPlan(draft.id);
  assert.equal(
    await Notification.count({ where: { userId: reader.id, kind: "plans" } }),
    0,
  );
  await request(leader, `/sermons/${draft.id}`, "PATCH", {
    status: "published",
  });
  assert.equal(
    await Notification.count({ where: { userId: reader.id, kind: "plans" } }),
    1,
  );
  const unattached = await createPlan();
  assert.equal(
    await Notification.count({ where: { userId: reader.id, kind: "plans" } }),
    1,
  );
  for (let i = 0; i < 2; i++)
    await request(leader, `/study-plans/${unattached.id}/sermon`, "PUT", {
      sermonId: published.id,
    });
  assert.equal(
    await Notification.count({ where: { userId: reader.id, kind: "plans" } }),
    2,
  );
});
test("ownership, unread filter, idempotent mark-one and mark-all", async () => {
  assert.equal(
    (await request(outsider, `/notifications/${notice.id}/read`, "PATCH"))
      .status,
    404,
  );
  assert.equal(
    (await request(reader, `/notifications/${notice.id}/read`, "PATCH")).status,
    200,
  );
  await request(reader, `/notifications/${notice.id}/read`, "PATCH");
  assert.ok(
    !(await request(reader, "/notifications?unread=true")).body.data.some(
      (n) => n.id === notice.id,
    ),
  );
  await request(reader, "/notifications/read-all", "PATCH");
  assert.equal(
    (await request(reader, "/notifications/unread-count")).body.data.count,
    0,
  );
});
test("preferences suppress future alerts and cannot change other users", async () => {
  assert.equal(
    (
      await request(reader, "/notifications/preferences", "PATCH", {
        sermons: false,
        plans: false,
        replies: true,
      })
    ).status,
    200,
  );
  const s = await createSermon("published");
  await createPlan(s.id);
  assert.equal(
    await Notification.count({ where: { userId: reader.id, sermonId: s.id } }),
    0,
  );
  assert.equal(
    await Notification.count({
      where: { userId: outsider.id, sermonId: s.id },
    }),
    1,
  );
  assert.equal(
    (
      await request(reader, "/notifications/preferences", "PATCH", {
        sermons: "false",
        plans: true,
        replies: true,
      })
    ).status,
    400,
  );
});
test("reply alerts target only parent author and link directly to the thread", async () => {
  group = await FellowshipGroup.create({
    name: "Notification group",
    leaderId: leader.id,
  });
  groups.push(group.id);
  for (const u of [reader, writer])
    await GroupMember.create({ groupId: group.id, userId: u.id });
  parent = await DiscussionPost.create({
    groupId: group.id,
    authorId: reader.id,
    content: "My private group post",
  });
  const r = await request(writer, `/groups/${group.id}/posts`, "POST", {
    content: "A reply",
    parentPostId: parent.id,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  replyNotice = (await request(reader, "/notifications")).body.data.find(
    (n) => n.kind === "replies",
  );
  assert.ok(replyNotice);
  assert.equal(replyNotice.target, `/groups/${group.id}?thread=${parent.id}`);
  assert.equal(
    await Notification.count({
      where: { userId: outsider.id, kind: "replies" },
    }),
    0,
  );
  await request(reader, `/groups/${group.id}/posts`, "POST", {
    content: "Own reply",
    parentPostId: parent.id,
  });
  assert.equal(
    await Notification.count({ where: { userId: reader.id, kind: "replies" } }),
    1,
  );
  const posts = await request(
    reader,
    `/groups/${group.id}/posts?threadId=${parent.id}`,
  );
  assert.equal(posts.body.data.length, 1);
  assert.equal(posts.body.data[0].id, parent.id);
});
test("leaving group hides alerts, disallows read mutation and stops new delivery", async () => {
  await GroupMember.destroy({
    where: { userId: reader.id, groupId: group.id },
  });
  assert.ok(
    !(await request(reader, "/notifications")).body.data.some(
      (n) => n.id === replyNotice.id,
    ),
  );
  assert.equal(
    (await request(reader, `/notifications/${replyNotice.id}/read`, "PATCH"))
      .status,
    404,
  );
  await request(writer, `/groups/${group.id}/posts`, "POST", {
    content: "Another reply",
    parentPostId: parent.id,
  });
  assert.equal(
    await Notification.count({ where: { userId: reader.id, kind: "replies" } }),
    1,
  );
});
test("unpublished/deleted content disappears and pagination is bounded", async () => {
  await request(leader, `/sermons/${published.id}`, "PATCH", {
    status: "draft",
  });
  assert.ok(
    !(await request(reader, "/notifications")).body.data.some(
      (n) => n.id === notice.id,
    ),
  );
  assert.equal((await request(reader, "/notifications?limit=101")).status, 400);
  const page = await request(outsider, "/notifications?limit=1");
  assert.equal(page.body.data.length, 1);
  assert.ok(page.body.meta.totalPages > 1);
  await DiscussionPost.destroy({ where: { id: parent.id } });
  assert.equal(await Notification.count({ where: { id: replyNotice.id } }), 0);
});

test("notification failure rolls back publication; inactive accounts receive no alerts", async () => {
  const draft = await createSermon();
  const original = sequelize.query;
  sequelize.query = function (sql, ...args) {
    if (typeof sql === "string" && sql.startsWith("INSERT INTO notifications"))
      return Promise.reject(new Error("Simulated notification write failure"));
    return original.call(this, sql, ...args);
  };
  try {
    assert.equal(
      (
        await request(leader, `/sermons/${draft.id}`, "PATCH", {
          status: "published",
        })
      ).status,
      500,
    );
  } finally {
    sequelize.query = original;
  }
  assert.equal((await Sermon.findByPk(draft.id)).status, "draft");
  await writer.update({ isActive: false });
  try {
    assert.equal(
      (
        await request(leader, `/sermons/${draft.id}`, "PATCH", {
          status: "published",
        })
      ).status,
      200,
    );
    assert.equal(
      await Notification.count({
        where: { userId: writer.id, sermonId: draft.id },
      }),
      0,
    );
  } finally {
    await writer.update({ isActive: true });
  }
});
