// Invented metadata/text only. No live key or licensed passage is used.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { YouVersion } from "../dist/services/youversion.js";
const nativeFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = nativeFetch;
});
const version = {
  id: 9876,
  abbreviation: "TEST",
  title: "Test Edition",
  localized_abbreviation: "TEST",
  localized_title: "Test Edition",
  language_tag: "en",
  books: ["JHN"],
  youversion_deep_link: "https://www.bible.com/versions/9876",
  copyright: "Current test attribution",
};
const index = {
  books: [
    {
      id: "JHN",
      title: "John",
      chapters: [
        { id: "1", verses: [{ id: "1" }, { id: "2" }, { id: "3" }] },
        { id: "2", verses: [{ id: "1" }] },
      ],
    },
  ],
};
function mock(handler) {
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://api.youversion.com");
    assert.equal(new Headers(options.headers).get("x-yvp-app-key"), "test-key");
    return handler(parsed, options);
  };
}
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function standard(url) {
  if (url.pathname === "/v1/bibles") return json({ data: [version] });
  if (url.pathname.endsWith("/index")) return json(index);
  if (url.pathname === "/v1/bibles/9876") return json(version);
  if (url.pathname.includes("/passages/"))
    return json({
      id: "JHN.1.1",
      reference: "John 1:1",
      content:
        '<p><span class="v" data-usfm="JHN.1.1"><span class="label">1</span><span class="content">Invented fixture text.</span></span><script>window.BAD=true</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">bad</a></p>',
    });
  throw new Error("Unexpected route: " + url.pathname);
}
test("catalog uses licensed-only English query, page size 99, and follows opaque tokens", async () => {
  const seen = [];
  mock((url) => {
    seen.push(url);
    assert.equal(url.searchParams.get("all_available"), "false");
    assert.deepEqual(url.searchParams.getAll("language_ranges[]"), ["en"]);
    assert.equal(url.searchParams.get("page_size"), "99");
    return url.searchParams.has("page_token")
      ? json({
          data: [
            { ...version, id: 9877 },
            { ...version, id: 9878, language_tag: "es" },
          ],
        })
      : json({ data: [version], next_page_token: "opaque+/=" });
  });
  const data = await new YouVersion("test-key").translations();
  assert.deepEqual(
    data.map((v) => v.id),
    ["yv-9876", "yv-9877"],
  );
  assert.equal(seen[1].searchParams.get("page_token"), "opaque+/=");
});
test("204 collection is empty and repeated tokens fail without looping", async () => {
  mock(() => new Response(null, { status: 204 }));
  assert.deepEqual(await new YouVersion("test-key").translations(), []);
  let calls = 0;
  mock(() => {
    calls++;
    return json({ data: [], next_page_token: "same" });
  });
  await assert.rejects(
    new YouVersion("test-key").translations(),
    (e) => e.statusCode === 503,
  );
  assert.equal(calls, 2);
});
test("unlisted IDs are denied before index or passage requests", async () => {
  mock((url) => {
    assert.equal(url.pathname, "/v1/bibles");
    return json({ data: [version] });
  });
  await assert.rejects(
    new YouVersion("test-key").passage({
      translationId: "yv-111",
      reference: "John 1:1",
    }),
    (e) => e.statusCode === 403,
  );
});
test("provider index supplies actual book, chapter, and verse bounds", async () => {
  mock(standard);
  const yv = new YouVersion("test-key");
  assert.deepEqual(await yv.books("yv-9876"), [
    { id: "JHN", name: "John", chapters: 2 },
  ]);
  assert.deepEqual(await yv.chapters("yv-9876", "JHN"), [
    { number: 1, verses: 3 },
    { number: 2, verses: 1 },
  ]);
  for (const reference of ["John 1:4", "John 1:3-1"])
    await assert.rejects(
      yv.passage({ translationId: "yv-9876", reference }),
      (e) => e.statusCode === 400,
    );
  await assert.rejects(
    yv.passage({ translationId: "yv-9876", reference: "John 3" }),
    (e) => e.statusCode === 404,
  );
});
test("official SDK transforms/sanitizes HTML and returns current attribution on each request", async () => {
  let attribution = 0;
  const passages = [];
  mock((url) => {
    if (url.pathname === "/v1/bibles/9876")
      return json({ ...version, copyright: `Attribution ${++attribution}` });
    if (url.pathname.includes("/passages/")) passages.push(url);
    return standard(url);
  });
  const yv = new YouVersion("test-key");
  for (let i = 1; i <= 2; i++) {
    const p = await yv.passage({
      translationId: "yv-9876",
      reference: "Jn 1:1–2",
    });
    assert.equal(p.translation.attribution, `Attribution ${i}`);
    assert.match(p.display.html, /Invented fixture text/);
    assert.doesNotMatch(p.display.html, /<script|onerror|javascript:/i);
    assert.deepEqual(p.display.containerAttributes, {
      "data-yv-sdk": "",
      "data-slot": "yv-bible-renderer",
    });
    assert.equal(p.display.stylesheets.length, 2);
    assert.equal(p.previous, null);
    assert.deepEqual(p.next, { bookId: "JHN", chapter: 2 });
  }
  assert.equal(passages[0].pathname, "/v1/bibles/9876/passages/JHN.1.1-2");
  assert.equal(passages[0].searchParams.get("format"), "html");
});
test("missing attribution fails instead of displaying incomplete licensed text", async () => {
  mock((url) =>
    url.pathname === "/v1/bibles/9876"
      ? json({ ...version, copyright: " ", promotional_content: null })
      : standard(url),
  );
  await assert.rejects(
    new YouVersion("test-key").passage({
      translationId: "yv-9876",
      bookId: "JHN",
      chapter: 1,
    }),
    (e) => e.statusCode === 503,
  );
});
test("upstream errors do not leak key or request details", async () => {
  for (const status of [401, 403, 429, 500]) {
    mock(() => json({ message: "secret test-key request details" }, status));
    await assert.rejects(
      new YouVersion("test-key").translations(),
      (e) => e.statusCode === 503 && !e.message.includes("test-key"),
    );
  }
  mock(() => {
    throw new Error("request timeout test-key");
  });
  await assert.rejects(
    new YouVersion("test-key").translations(),
    (e) => e.statusCode === 503 && !e.message.includes("test-key"),
  );
});
