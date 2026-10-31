// Requires the current schema in a local development database. Never calls Cloudinary.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';
import { sequelize } from '../dist/config/database.js';
import { User } from '../dist/models/index.js';
import { signToken } from '../dist/middleware/auth.js';
import { AppError } from '../dist/utils/AppError.js';
if (!['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Use a local development database.');
const assets = new Map(), removed = [], accounts = [];
let failUpload = false, failCleanup = false, deactivateDuringUpload = null;
const storage = {
  assertConfigured() {},
  async upload(bytes, publicId) {
    assets.set(publicId, bytes);
    if (deactivateDuringUpload) await User.update({ isActive: false }, { where: { id: deactivateDuringUpload } });
    if (failUpload) throw new AppError(502, 'Storage temporarily unavailable');
    return { publicId, url: `https://res.cloudinary.com/test/image/upload/${publicId}.jpg` };
  },
  async destroy(publicId) {
    const owner = publicId.split('/')[2]; const user = await User.findByPk(owner);
    assert.notEqual(user?.avatarPublicId, publicId, 'Never delete the account’s current photo');
    removed.push(publicId);
    if (failCleanup) throw new Error('Offline');
    assets.delete(publicId);
  },
};
const server = createApp({ avatarStorage: storage }).listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
async function account() { const user = await User.create({ name: 'Photo Test', email: `avatar.${crypto.randomUUID()}@example.com`, passwordHash: 'not-a-login-hash' }); accounts.push(user.id); return user; }
const png = await sharp({ create: { width: 40, height: 80, channels: 3, background: '#254c3c' } }).png().withMetadata().toBuffer();
function form(bytes = png, type = 'image/png') { const body = new FormData(); body.append('avatar', new Blob([bytes], { type }), 'photo.png'); return body; }
async function call(user, method = 'PUT', body = form()) {
  const response = await fetch(`${base}/api/v1/users/me/avatar`, { method, ...(method === 'PUT' ? { body } : {}), headers: user ? { authorization: `Bearer ${signToken({ id: user.id, role: user.role })}` } : {} });
  return { status: response.status, json: await response.json() };
}
after(async () => { await User.destroy({ where: { id: accounts } }); await new Promise(resolve => server.close(resolve)); await sequelize.close(); });

test('authenticated upload returns public URL, normalized metadata-free image, and keeps storage ID private', async () => {
  const user = await account(); const result = await call(user);
  assert.equal(result.status, 200); assert.match(result.json.data.avatarUrl, /^https:/);
  assert.equal('avatarPublicId' in result.json.data, false); assert.equal('passwordHash' in result.json.data, false);
  await user.reload(); const meta = await sharp(assets.get(user.avatarPublicId)).metadata();
  assert.equal(meta.format, 'jpeg'); assert.equal(meta.width, 400); assert.equal(meta.height, 400); assert.equal(meta.exif, undefined); assert.equal(meta.icc, undefined);
  const me = await fetch(`${base}/api/v1/users/me`, { headers: { authorization: `Bearer ${signToken({ id:user.id,role:user.role })}` } });
  assert.equal((await me.json()).data.avatarUrl, user.avatarUrl);
});
test('replacement commits the new photo before deleting old; removal is idempotent', async () => {
  const user = await account(); assert.equal((await call(user)).status, 200); await user.reload(); const old = user.avatarPublicId;
  assert.equal((await call(user)).status, 200); await user.reload(); assert.notEqual(user.avatarPublicId, old); assert.ok(removed.includes(old)); assert.equal(assets.has(old), false);
  const result = await call(user, 'DELETE'); assert.equal(result.status, 200); assert.equal(result.json.data.avatarUrl, null);
  assert.equal((await call(user, 'DELETE')).status, 200);
});
test('storage failure preserves previous photo and cleans up uncertain new upload', async () => {
  const user = await account(); await call(user); await user.reload(); const old = user.avatarPublicId;
  failUpload = true; try { assert.equal((await call(user)).status, 502); } finally { failUpload = false; }
  await user.reload(); assert.equal(user.avatarPublicId, old); assert.ok(assets.has(old));
  assert.equal([...assets.keys()].filter(id => id.includes(user.id)).length, 1);
});
test('concurrent replacement retains exactly the current asset', async () => {
  const user = await account(); const results = await Promise.all([call(user), call(user)]); assert.ok(results.every(r => r.status === 200));
  await user.reload(); const retained = [...assets.keys()].filter(id => id.includes(user.id)); assert.deepEqual(retained, [user.avatarPublicId]);
});
test('account deactivation during upload prevents save and retires the new asset', async () => {
  const user = await account(); deactivateDuringUpload = user.id;
  try { assert.equal((await call(user)).status, 401); } finally { deactivateDuringUpload = null; }
  await user.reload(); assert.equal(user.avatarUrl, null); assert.equal([...assets.keys()].some(id => id.includes(user.id)), false);
});
test('old asset cleanup failure does not undo a successfully saved replacement', async () => {
  const user = await account(); await call(user); await user.reload(); const old = user.avatarPublicId;
  failCleanup = true; try { assert.equal((await call(user)).status, 200); } finally { failCleanup = false; }
  await user.reload(); assert.notEqual(user.avatarPublicId, old); assert.ok(assets.has(user.avatarPublicId));
});
test('rejects missing, unexpected, oversized, corrupt, mismatched, SVG and excessive-pixel uploads', async () => {
  const user = await account();
  assert.equal((await call(user, 'PUT', new FormData())).status, 400);
  const injected = form(); injected.append('userId', accounts[0]); assert.equal((await call(user, 'PUT', injected)).status, 400);
  assert.equal((await call(user, 'PUT', form(Buffer.alloc(5 * 1024 * 1024 + 1)))).status, 413);
  assert.equal((await call(user, 'PUT', form(Buffer.from('not an image')))).status, 400);
  assert.equal((await call(user, 'PUT', form(png, 'image/jpeg'))).status, 400);
  assert.equal((await call(user, 'PUT', form(Buffer.from('<svg/>'), 'image/svg+xml'))).status, 400);
  const huge = await sharp({ create: { width: 4100, height: 4100, channels: 3, background: '#254c3c' } }).png().toBuffer();
  assert.equal((await call(user, 'PUT', form(huge))).status, 400);
  const malformed = await fetch(`${base}/api/v1/users/me/avatar`, { method: 'PUT', headers: { authorization: `Bearer ${signToken({id:user.id,role:user.role})}`, 'content-type': 'multipart/form-data; boundary=missing' }, body: 'invalid form' });
  assert.equal(malformed.status, 400);
  await user.reload(); assert.equal(user.avatarUrl, null);
});
test('requires authentication, enforces account scope and per-account rate limit', async () => {
  assert.equal((await call(null)).status, 401); const user = await account();
  for (let i=0;i<10;i++) assert.equal((await call(user, 'DELETE')).status,200);
  assert.equal((await call(user, 'DELETE')).status,429);
  const alternate = await account(); assert.equal((await call(alternate, 'DELETE')).status,200);
});
test('CORS allows cross-origin PUT uploads', async () => {
  const response = await fetch(`${base}/api/v1/users/me/avatar`, { method:'OPTIONS', headers:{ origin:'https://example.com','access-control-request-method':'PUT' } });
  assert.equal(response.status,204); assert.match(response.headers.get('access-control-allow-methods'),/PUT/);
});
test('missing storage configuration returns actionable 503 and leaves account unchanged', async () => {
  const app = createApp({ avatarStorage:{ ...storage, assertConfigured(){ throw new AppError(503,'Profile photo storage is not configured'); } } });
  const local = app.listen(0,'127.0.0.1'); await once(local,'listening'); const user = await account();
  try { const result = await fetch(`http://127.0.0.1:${local.address().port}/api/v1/users/me/avatar`, { method:'PUT',body:form(),headers:{authorization:`Bearer ${signToken({id:user.id,role:user.role})}`} }); assert.equal(result.status,503); await user.reload(); assert.equal(user.avatarUrl,null); }
  finally { await new Promise(resolve=>local.close(resolve)); }
});
