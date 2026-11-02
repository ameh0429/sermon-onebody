// Public-domain corpus/service tests plus authenticated HTTP routes. Uses only local fixtures.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { translations, books, chapters, passage } from '../dist/services/bible.js';
import { createApp } from '../dist/app.js';
import { sequelize } from '../dist/config/database.js';
import { User } from '../dist/models/index.js';
import { signToken } from '../dist/middleware/auth.js';
if (!['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Use a local development database.');
const user = await User.create({name:'Bible Test',email:`bible.${crypto.randomUUID()}@example.com`,passwordHash:'not-a-login-password'});
const server=createApp().listen(0,'127.0.0.1'); await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}/api/v1/bible`;
const headers={authorization:`Bearer ${signToken({id:user.id,role:user.role})}`};
after(async()=>{await user.destroy();await new Promise(resolve=>server.close(resolve));await sequelize.close();});
test('both complete corpora match pinned checksums and canonical counts',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../data/bibles/manifest.json',import.meta.url),'utf8'));
 for(const t of translations){const bytes=await readFile(new URL(`../data/bibles/${t.id}.json.gz`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest[t.id].sha256);const data=JSON.parse(gunzipSync(bytes));assert.equal(data.books.length,66);assert.equal(data.books.reduce((n,b)=>n+b.chapters.length,0),1189);assert.equal(data.books.reduce((n,b)=>n+b.chapters.reduce((m,c)=>m+c.verses.length,0),0),31102);for(const b of data.books)for(const c of b.chapters){assert.deepEqual(c.verses.map(v=>v.number),Array.from({length:c.verses.length},(_,i)=>i+1));}}
});
test('books and chapters have stable IDs and actual counts',async()=>{const b=await books('asv');assert.equal(b[0].id,'GEN');assert.equal(b.at(-1).id,'REV');assert.equal(b.find(b=>b.id==='PSA').chapters,150);const c=await chapters('ylt','PSA');assert.equal(c[118].verses,176);});
test('John 3:16 switches to genuinely different edition text with attribution',async()=>{const a=await passage({translationId:'asv',reference:'John 3:16'});const y=await passage({translationId:'ylt',reference:'John 3:16'});assert.equal(a.verses.length,1);assert.match(a.verses[0].text,/For God so loved/);assert.match(y.verses[0].text,/for God did so love/);assert.notEqual(a.verses[0].text,y.verses[0].text);assert.match(a.translation.attribution,/Public domain/);});
test('aliases, numbered books, case and en/em dash ranges resolve canonically',async()=>{for(const ref of ['Eph. 2:1-10','ephesians 2:1–10','EPH 2:1—10']){const p=await passage({translationId:'asv',reference:ref});assert.equal(p.reference,'Ephesians 2:1–10');assert.equal(p.verses.length,10);}for(const ref of ['1 John 1:9','1Jn 1:9','I John 1:9'])assert.equal((await passage({translationId:'asv',reference:ref})).book.id,'1JN');});
test('chapter navigation crosses book boundaries and disables ends',async()=>{assert.equal((await passage({translationId:'asv',bookId:'GEN',chapter:1})).previous,null);assert.deepEqual((await passage({translationId:'asv',bookId:'GEN',chapter:50})).next,{bookId:'EXO',chapter:1});assert.deepEqual((await passage({translationId:'asv',bookId:'EXO',chapter:1})).previous,{bookId:'GEN',chapter:50});assert.equal((await passage({translationId:'ylt',bookId:'REV',chapter:22})).next,null);});
test('absent source verse has a note without substituting another translation',async()=>{const a=await passage({translationId:'asv',reference:'John 5:4'});assert.equal(a.verses[0].text,'');assert.match(a.verses[0].note,/not present/);assert.ok((await passage({translationId:'ylt',reference:'John 5:4'})).verses[0].text);});
test('invalid or unsupported references, translations and bounds fail usefully',async()=>{for(const ref of ['NotABook 1','John 3:18-16','John 3:999','John 3-4','John 3:16,18','John 3:16-4:2'])await assert.rejects(passage({translationId:'asv',reference:ref}),e=>e.statusCode===400);await assert.rejects(passage({translationId:'asv',reference:'John 99'}),e=>e.statusCode===404);await assert.rejects(books('../asv'),e=>e.statusCode===400);});
test('HTTP endpoints require authentication and provide no-store responses',async()=>{for(const path of ['/translations','/books','/chapters?bookId=JHN','/passages?reference=John%203:16']){assert.equal((await fetch(base+path)).status,401);const response=await fetch(base+path,{headers});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal((await response.json()).status,'success');}});
test('HTTP validation rejects ambiguous, invalid and out-of-range requests',async()=>{for(const query of ['translationId=esv&reference=John3','bookId=JHN','reference=John3&bookId=JHN','bookId=JHN&chapter=0','bookId=JHN&chapter=3&toVerse=5','reference=John%203:20-2'])assert.equal((await fetch(base+'/passages?'+query,{headers})).status,400);assert.equal((await fetch(base+'/chapters?bookId=ZZZ',{headers})).status,404);});
test('Swagger exposes Bible schemas and bearer protection',async()=>{const spec=await(await fetch(base.replace('/api/v1/bible','/docs.json'))).json();assert.ok(spec.components.schemas.BiblePassage);for(const path of ['/bible/translations','/bible/books','/bible/chapters','/bible/passages'])assert.ok(spec.paths[path].get.security[0].bearerAuth);});
