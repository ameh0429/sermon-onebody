// End-to-end smoke test. Run against a live server with a seeded admin:
//   BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke-test.mjs
const BASE = (process.env.BASE_URL ?? 'http://localhost:3000') + '/api/v1';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'admin@example.com', password: process.env.ADMIN_PASSWORD ?? 'ChangeMe123!' };
const run = Date.now();

let passed = 0;
let failed = 0;
function check(name, condition, extra) {
  if (condition) passed++;
  else {
    failed++;
    console.log(`  FAIL: ${name}`, extra ?? '');
  }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, headers: res.headers };
}

async function register(name) {
  const r = await call('POST', '/auth/register', { body: { name, email: `${name.toLowerCase()}.${run}@example.com`, password: 'Passw0rd!123' } });
  check(`register ${name}`, r.status === 201, r.json);
  return { token: r.json.data.token, id: r.json.data.user.id };
}

// ---------------------------------------------------------------- auth
console.log('Auth');
const admin = await call('POST', '/auth/login', { body: ADMIN });
check('admin login', admin.status === 200, admin.json);
const adminToken = admin.json.data.token;

const grace = await register('Grace');
const john = await register('John');
const mary = await register('Mary');

check('duplicate email -> 409', (await call('POST', '/auth/register', { body: { name: 'Grace', email: `grace.${run}@example.com`, password: 'Passw0rd!123' } })).status === 409);
check('bad login -> 401', (await call('POST', '/auth/login', { body: { email: `grace.${run}@example.com`, password: 'wrong-password' } })).status === 401);
check('invalid body -> 400', (await call('POST', '/auth/register', { body: { name: 'x', email: 'nope', password: '1' } })).status === 400);
check('no token -> 401', (await call('GET', '/sermons')).status === 401);
check('garbage token -> 401', (await call('GET', '/sermons', { token: 'abc.def.ghi' })).status === 401);
const me = await call('GET', '/users/me', { token: grace.token });
check('GET /users/me', me.status === 200 && !('passwordHash' in me.json.data), me.json);

// ------------------------------------------------------------- sermons
console.log('Sermons');
const sermonBody = { title: `Walking in Grace ${run}`, preacher: 'Pastor John Adeyemi', passage: 'Ephesians 2:1-10', sermonDate: '2026-09-27', summary: 'Grace is a gift.', content: 'Full text', tags: ['grace', 'salvation'] };
check('member cannot create sermon -> 403', (await call('POST', '/sermons', { token: grace.token, body: sermonBody })).status === 403);
const created = await call('POST', '/sermons', { token: adminToken, body: sermonBody });
check('admin creates sermon', created.status === 201, created.json);
const sermonId = created.json.data.id;
await call('POST', '/sermons', { token: adminToken, body: { ...sermonBody, title: `Faith ${run}`, preacher: 'Pastor Ruth', passage: 'Hebrews 11', sermonDate: '2026-10-04', tags: ['faith'] } });

const list1 = await call('GET', `/sermons?preacher=adeyemi&tag=grace&q=${run}`, { token: grace.token });
check('list + filter', list1.status === 200 && list1.json.data.length === 1 && list1.json.meta.total === 1, list1.json);
check('list omits content', list1.json.data[0] && !('content' in list1.json.data[0]));
check('first list is MISS', list1.headers.get('x-cache') === 'MISS');
const list2 = await call('GET', `/sermons?preacher=adeyemi&tag=grace&q=${run}`, { token: grace.token });
check('second list is cached', list2.headers.get('x-cache') === 'HIT');
const dateFiltered = await call('GET', `/sermons?q=${run}&from=2026-10-01`, { token: grace.token });
check('date filter', dateFiltered.json.data.length === 1 && dateFiltered.json.data[0].preacher === 'Pastor Ruth', dateFiltered.json);
check('bad query -> 400', (await call('GET', '/sermons?limit=1000', { token: grace.token })).status === 400);
const detail = await call('GET', `/sermons/${sermonId}`, { token: grace.token });
check('details include content', detail.json.data.content === 'Full text');
await call('PATCH', `/sermons/${sermonId}`, { token: adminToken, body: { summary: 'Updated summary' } });
const list3 = await call('GET', `/sermons?preacher=adeyemi&tag=grace&q=${run}`, { token: grace.token });
check('cache invalidated on update', list3.headers.get('x-cache') === 'MISS' && list3.json.data[0].summary === 'Updated summary');
check('404 unknown sermon', (await call('GET', '/sermons/00000000-0000-4000-8000-000000000000', { token: grace.token })).status === 404);

// ----------------------------------------------------------- bookmarks
console.log('Bookmarks');
check('add bookmark', (await call('POST', '/bookmarks', { token: grace.token, body: { sermonId } })).status === 201);
check('bookmark is idempotent', (await call('POST', '/bookmarks', { token: grace.token, body: { sermonId } })).status === 200);
const marks = await call('GET', '/bookmarks', { token: grace.token });
check('list bookmarks', marks.json.data.length === 1 && marks.json.data[0].sermon.title.startsWith('Walking'));
check("other user's bookmarks are separate", (await call('GET', '/bookmarks', { token: john.token })).json.data.length === 0);
check('remove bookmark', (await call('DELETE', `/bookmarks/${sermonId}`, { token: grace.token })).status === 204);
check('remove again -> 404', (await call('DELETE', `/bookmarks/${sermonId}`, { token: grace.token })).status === 404);

// ------------------------------------------------------------- journal
console.log('Journal');
const entry = await call('POST', '/journal', { token: grace.token, body: { title: 'Private thoughts <script>alert(1)</script>', content: 'Only for me', sermonId } });
check('create entry (private by default)', entry.status === 201 && entry.json.data.isShared === false, entry.json);
check('HTML is sanitized', !entry.json.data.title.includes('<script>'), entry.json.data.title);
const entryId = entry.json.data.id;
check("others can't read private entry (404)", (await call('GET', `/journal/${entryId}`, { token: john.token })).status === 404);
check("others can't update it (404)", (await call('PATCH', `/journal/${entryId}`, { token: john.token, body: { title: 'hacked' } })).status === 404);
check("others can't delete it (404)", (await call('DELETE', `/journal/${entryId}`, { token: john.token })).status === 404);
check("others' list is empty", (await call('GET', '/journal', { token: john.token })).json.data.length === 0);
check('owner reads entry', (await call('GET', `/journal/${entryId}`, { token: grace.token })).status === 200);
check('share without group -> 400', (await call('PATCH', `/journal/${entryId}`, { token: grace.token, body: { isShared: true } })).status === 400);

// -------------------------------------------------------------- groups
console.log('Groups');
check('member cannot create group -> 403', (await call('POST', '/groups', { token: grace.token, body: { name: 'Nope group' } })).status === 403);
check('non-admin cannot change roles -> 403', (await call('PATCH', `/users/${john.id}/role`, { token: grace.token, body: { role: 'leader' } })).status === 403);
const promoted = await call('PATCH', `/users/${john.id}/role`, { token: adminToken, body: { role: 'leader' } });
check('admin promotes John to leader', promoted.status === 200 && promoted.json.data.role === 'leader', promoted.json);
// role is embedded in the JWT, so John logs in again to pick up the new role
const johnLeader = await call('POST', '/auth/login', { body: { email: `john.${run}@example.com`, password: 'Passw0rd!123' } });
const johnToken = johnLeader.json.data.token;

const group = await call('POST', '/groups', { token: johnToken, body: { name: `Tuesday Fellowship ${run}`, description: 'Weekly discussion' } });
check('leader creates group', group.status === 201, group.json);
const groupId = group.json.data.id;
const detailG = await call('GET', `/groups/${groupId}`, { token: grace.token });
check('group has leader enrolled (memberCount 1)', detailG.json.data.memberCount === 1, detailG.json);

check('non-member cannot see members -> 403', (await call('GET', `/groups/${groupId}/members`, { token: grace.token })).status === 403);
check('non-member cannot post -> 403', (await call('POST', `/groups/${groupId}/posts`, { token: grace.token, body: { content: 'hi' } })).status === 403);
check('Grace joins', (await call('POST', `/groups/${groupId}/join`, { token: grace.token })).status === 201);
check('join is idempotent', (await call('POST', `/groups/${groupId}/join`, { token: grace.token })).status === 200);
check('Mary joins', (await call('POST', `/groups/${groupId}/join`, { token: mary.token })).status === 201);
const members = await call('GET', `/groups/${groupId}/members`, { token: grace.token });
check('members listed, leader first', members.json.data.length === 3 && members.json.data[0].role === 'leader', members.json);
check('leader cannot leave', (await call('DELETE', `/groups/${groupId}/leave`, { token: johnToken })).status === 400);
check('mine=true filter', (await call('GET', '/groups?mine=true', { token: grace.token })).json.data.some((g) => g.id === groupId));
check('non-leader cannot edit group -> 403', (await call('PATCH', `/groups/${groupId}`, { token: grace.token, body: { name: 'Hijacked' } })).status === 403);

// journal sharing
const shared = await call('PATCH', `/journal/${entryId}`, { token: grace.token, body: { isShared: true, sharedWithGroupId: groupId } });
check('share entry with group', shared.status === 200 && shared.json.data.isShared === true, shared.json);
check('group member can read shared entry', (await call('GET', `/journal/${entryId}`, { token: mary.token })).status === 200);
check('shared list for group', (await call('GET', `/journal/shared?groupId=${groupId}`, { token: mary.token })).json.data.length === 1);
const outsider = await register('Outsider');
check('non-member still blocked from shared entry', (await call('GET', `/journal/${entryId}`, { token: outsider.token })).status === 404);
check('non-member cannot list shared', (await call('GET', `/journal/shared?groupId=${groupId}`, { token: outsider.token })).status === 403);
const unshared = await call('PATCH', `/journal/${entryId}`, { token: grace.token, body: { isShared: false } });
check('unshare clears group', unshared.json.data.isShared === false && unshared.json.data.sharedWithGroupId === null, unshared.json);
check('entry private again', (await call('GET', `/journal/${entryId}`, { token: mary.token })).status === 404);
check('cannot share with a group you are not in -> 403', (await call('PATCH', `/journal/${entryId}`, { token: outsider.token, body: { isShared: true, sharedWithGroupId: groupId } })).status === 404 /* not the owner */);
const ownEntry = await call('POST', '/journal', { token: outsider.token, body: { title: 't', content: 'c', isShared: true, sharedWithGroupId: groupId } });
check('cannot create entry shared to a foreign group -> 403', ownEntry.status === 403, ownEntry.json);

// ---------------------------------------------------------- discussions
console.log('Discussions');
const post = await call('POST', `/groups/${groupId}/posts`, { token: grace.token, body: { content: 'How do we balance grace and obedience?', sermonId } });
check('create post', post.status === 201, post.json);
const postId = post.json.data.id;
const reply = await call('POST', `/groups/${groupId}/posts`, { token: mary.token, body: { content: 'Obedience flows from gratitude.', parentPostId: postId } });
check('reply to post', reply.status === 201 && reply.json.data.sermonId === sermonId, reply.json);
const replyId = reply.json.data.id;
const nested = await call('POST', `/groups/${groupId}/posts`, { token: john.token, body: { content: 'nested', parentPostId: replyId } });
check('reply to a reply -> 400', nested.status === 400, nested.json);

const threads = await call('GET', `/groups/${groupId}/posts`, { token: mary.token });
check('threads with nested replies', threads.json.data.length === 1 && threads.json.data[0].replies.length === 1 && threads.json.data[0].replies[0].author.name === 'Mary', JSON.stringify(threads.json));
check('filter by sermon', (await call('GET', `/groups/${groupId}/posts?sermonId=${sermonId}`, { token: mary.token })).json.data.length === 1);
check('by-sermon across my groups', (await call('GET', `/sermons/${sermonId}/posts`, { token: mary.token })).json.data.length === 1);
check('outsider sees nothing by sermon', (await call('GET', `/sermons/${sermonId}/posts`, { token: outsider.token })).json.data.length === 0);
check('outsider cannot read group threads -> 403', (await call('GET', `/groups/${groupId}/posts`, { token: outsider.token })).status === 403);

// moderation
check("cannot flag own post -> 400", (await call('POST', `/posts/${postId}/flag`, { token: grace.token, body: { reason: 'x' } })).status === 400);
check('outsider cannot flag -> 403', (await call('POST', `/posts/${postId}/flag`, { token: outsider.token, body: { reason: 'x' } })).status === 403);
const flagged = await call('POST', `/posts/${postId}/flag`, { token: mary.token, body: { reason: 'Off topic' } });
check('member flags post', flagged.status === 200 && flagged.json.data.isFlagged === true, flagged.json);
check('member cannot view flagged queue -> 403', (await call('GET', `/groups/${groupId}/posts/flagged`, { token: mary.token })).status === 403);
const queue = await call('GET', `/groups/${groupId}/posts/flagged`, { token: johnToken });
check('leader sees flagged queue', queue.status === 200 && queue.json.data.length === 1, queue.json);
check('member cannot delete others post -> 403', (await call('DELETE', `/posts/${postId}`, { token: mary.token })).status === 403);
check('leader deletes post', (await call('DELETE', `/posts/${postId}`, { token: johnToken })).status === 204);
check('replies cascade-deleted', (await call('GET', `/groups/${groupId}/posts`, { token: mary.token })).json.data.length === 0);
const p2 = await call('POST', `/groups/${groupId}/posts`, { token: mary.token, body: { content: 'My own post' } });
check('author deletes own post', (await call('DELETE', `/posts/${p2.json.data.id}`, { token: mary.token })).status === 204);

check('Mary leaves group', (await call('DELETE', `/groups/${groupId}/leave`, { token: mary.token })).status === 204);
check('left member blocked -> 403', (await call('GET', `/groups/${groupId}/posts`, { token: mary.token })).status === 403);

// ------------------------------------------------------------- misc
console.log('Misc');
check('unknown route -> 404 JSON', (await call('GET', '/nope', { token: grace.token })).json?.status === 'error');
const bad = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json' });
check('malformed JSON -> 400', bad.status === 400);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
