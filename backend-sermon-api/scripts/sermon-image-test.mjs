// Local database and mocked image storage; never contacts Cloudinary.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import sharp from "sharp";
import { createApp } from "../dist/app.js";
import { sequelize } from "../dist/config/database.js";
import { User, Sermon } from "../dist/models/index.js";
import { signToken } from "../dist/middleware/auth.js";
import { AppError } from "../dist/utils/AppError.js";
if (
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error("Local database required");
const users = [];
for (const role of ["member", "leader", "admin"])
  users.push(
    await User.create({
      name: "Image Test",
      email: `image.${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-login",
      role,
    }),
  );
const record = await Sermon.create({
  title: "Image Test",
  preacher: "Pastor",
  passage: "John 1",
  sermonDate: "2026-11-02",
  status: "published",
});
const assets = new Map(),
  removed = [];
let fail = false;
const storage = {
  assertConfigured() {},
  async upload(bytes, publicId) {
    if (fail) throw new AppError(502, "Storage unavailable");
    assets.set(publicId, bytes);
    return {
      publicId,
      url: `https://res.cloudinary.com/test/image/upload/${publicId}.jpg`,
    };
  },
  async destroy(id) {
    assert.notEqual((await Sermon.findByPk(record.id))?.imagePublicId, id);
    removed.push(id);
    assets.delete(id);
  },
};
const server = createApp({ sermonImageStorage: storage }).listen(
  0,
  "127.0.0.1",
);
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}/api/v1/sermons`;
const headers = (user) =>
  user
    ? { authorization: `Bearer ${signToken({ id: user.id, role: user.role })}` }
    : {};
const png = await sharp({
  create: { width: 1800, height: 900, channels: 3, background: "#ae5085" },
})
  .png()
  .withMetadata()
  .toBuffer();
function form(bytes = png, type = "image/png") {
  const data = new FormData();
  data.set("image", new Blob([bytes], { type }), "sermon.png");
  return data;
}
async function upload(user = users[1], body = form()) {
  return fetch(`${base}/${record.id}/image`, {
    method: "PUT",
    headers: headers(user),
    body,
  });
}
after(async () => {
  await record.destroy();
  await User.destroy({ where: { id: users.map((u) => u.id) } });
  await new Promise((r) => server.close(r));
  await sequelize.close();
});
test("members retain read access but cannot upload/remove; anonymous uploads rejected", async () => {
  assert.equal((await fetch(base, { headers: headers(users[0]) })).status, 200);
  assert.equal((await upload(null)).status, 401);
  assert.equal((await upload(users[0])).status, 403);
  assert.equal(
    (
      await fetch(`${base}/${record.id}/image`, {
        method: "DELETE",
        headers: headers(users[0]),
      })
    ).status,
    403,
  );
});
test("upload normalizes image, updates detail and invalidates member list cache", async () => {
  await fetch(base, { headers: headers(users[0]) });
  const response = await upload();
  assert.equal(response.status, 200);
  const saved = (await response.json()).data;
  assert.ok(saved.imageUrl);
  const bytes = assets.get(saved.imagePublicId);
  const meta = await sharp(bytes).metadata();
  assert.equal(meta.width, 1600);
  assert.equal(meta.height, 800);
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.exif, undefined);
  const list = await (await fetch(base, { headers: headers(users[0]) })).json();
  assert.equal(
    list.data.find((s) => s.id === record.id).imageUrl,
    saved.imageUrl,
  );
  assert.equal(
    (
      await (
        await fetch(`${base}/${record.id}`, { headers: headers(users[0]) })
      ).json()
    ).data.imageUrl,
    saved.imageUrl,
  );
});
test("replacement retires previous asset after database commit", async () => {
  const previous = (await record.reload()).imagePublicId;
  assert.equal((await upload(users[2])).status, 200);
  await record.reload();
  assert.notEqual(record.imagePublicId, previous);
  assert.ok(removed.includes(previous));
});
test("storage failure retains previous image", async () => {
  const previous = (await record.reload()).imageUrl;
  fail = true;
  assert.equal((await upload()).status, 502);
  fail = false;
  assert.equal((await record.reload()).imageUrl, previous);
});
test("invalid, mismatched and oversized uploads are rejected", async () => {
  assert.equal(
    (await upload(users[1], form(Buffer.from("invalid")))).status,
    400,
  );
  assert.equal((await upload(users[1], form(png, "image/jpeg"))).status, 400);
  assert.equal(
    (await upload(users[1], form(Buffer.alloc(5 * 1024 * 1024 + 1)))).status,
    413,
  );
});
test("removal restores null and is idempotent", async () => {
  for (let i = 0; i < 2; i++) {
    const response = await fetch(`${base}/${record.id}/image`, {
      method: "DELETE",
      headers: headers(users[1]),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.imageUrl, null);
  }
  assert.equal(assets.size, 0);
});
