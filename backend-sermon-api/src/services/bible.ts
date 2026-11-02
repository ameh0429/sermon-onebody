import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { AppError } from '../utils/AppError.js';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('../../data/bibles/manifest.json', import.meta.url), 'utf8')) as Record<'asv' | 'ylt', { sourceUrl: string; sha256: string }>;

export const translations = [
  { id: 'asv', abbreviation: 'ASV', name: 'American Standard Version (1901)', language: 'English', attribution: 'American Standard Version (1901). Public domain.', sourceUrl: manifest.asv.sourceUrl, licence: 'Public domain' },
  { id: 'ylt', abbreviation: 'YLT', name: "Young’s Literal Translation (1898)", language: 'English', attribution: "Young’s Literal Translation (1898). Public domain.", sourceUrl: manifest.ylt.sourceUrl, licence: 'Public domain' },
] as const;
type TranslationId = typeof translations[number]['id'];
interface Verse { number: number; text: string }
interface Chapter { number: number; verses: Verse[] }
interface Book { id: string; name: string; chapters: Chapter[] }
interface Bible { id: string; books: Book[] }
const cached = new Map<TranslationId, Promise<Bible>>();
export function translation(id: string) {
  const found = translations.find(t => t.id === id);
  if (!found) throw AppError.badRequest('Choose a supported translation: asv or ylt.');
  return found;
}
async function load(id: string): Promise<Bible> {
  const { id: code } = translation(id);
  let promise = cached.get(code);
  if (!promise) {
    promise = (async () => {
      const bytes = await readFile(new URL(`../../data/bibles/${code}.json.gz`, import.meta.url));
      if (createHash('sha256').update(bytes).digest('hex') !== manifest[code].sha256) throw new Error('Bible data checksum mismatch');
      const data: Bible = JSON.parse(gunzipSync(bytes, { maxOutputLength: 12 * 1024 * 1024 }).toString('utf8'));
      if (data.id !== code || data.books.length !== 66) throw new Error('Invalid Bible corpus');
      return data;
    })();
    cached.set(code, promise);
  }
  try { return await promise; }
  catch { cached.delete(code); throw new AppError(503, 'Bible text is temporarily unavailable. Please try again later.'); }
}
export async function books(id: string) {
  return (await load(id)).books.map(b => ({ id: b.id, name: b.name, chapters: b.chapters.length }));
}
export async function chapters(id: string, bookId: string) {
  const book = (await load(id)).books.find(b => b.id === bookId);
  if (!book) throw AppError.notFound('Bible book not found.');
  return book.chapters.map(c => ({ number: c.number, verses: c.verses.length }));
}
const abbreviations: Record<string, string[]> = {
 GEN:['gen','ge','gn'],EXO:['ex','exo','exod'],LEV:['lev','lv'],NUM:['num','nm','nu'],DEU:['deut','dt'],JOS:['josh','jos'],JDG:['judg','jdg'],RUT:['ruth','ru'],
 '1SA':['1sam','1sa'],'2SA':['2sam','2sa'],'1KI':['1kgs','1ki'],'2KI':['2kgs','2ki'],'1CH':['1chr','1ch'],'2CH':['2chr','2ch'],EZR:['ezra','ezr'],NEH:['neh'],EST:['esth','est'],JOB:['job'],PSA:['ps','psalm','psalms','psa'],PRO:['prov','pr'],ECC:['eccl','ecc'],SNG:['songofsongs','song','sos','canticles'],ISA:['isa','is'],JER:['jer'],LAM:['lam'],EZK:['ezek','ezk'],DAN:['dan','dn'],HOS:['hos'],JOL:['joel','jl'],AMO:['amos','am'],OBA:['obad','ob'],JON:['jon','jonah'],MIC:['mic'],NAM:['nah','na'],HAB:['hab'],ZEP:['zeph','zep'],HAG:['hag'],ZEC:['zech','zec'],MAL:['mal'],MAT:['matt','mt'],MRK:['mark','mk'],LUK:['luke','lk'],JHN:['john','jn','jhn'],ACT:['acts','ac'],ROM:['rom','ro'],'1CO':['1cor','1co'],'2CO':['2cor','2co'],GAL:['gal'],EPH:['eph'],PHP:['phil','php'],COL:['col'],'1TH':['1thess','1th'],'2TH':['2thess','2th'],'1TI':['1tim','1ti'],'2TI':['2tim','2ti'],TIT:['titus','tit'],PHM:['philem','phm'],HEB:['heb'],JAS:['james','jas'],'1PE':['1pet','1pe'],'2PE':['2pet','2pe'],'1JN':['1john','1jn'],'2JN':['2john','2jn'],'3JN':['3john','3jn'],JUD:['jude','jud'],REV:['rev','revelationofjohn','revelations'],
};
function normalizeBook(value: string) {
  return value.trim().toLowerCase().replace(/^iii(?=\s|john)/,'3').replace(/^ii(?=\s|sam|king|chron|cor|thess|tim|pet|john)/,'2').replace(/^i(?=\s|sam|king|chron|cor|thess|tim|pet|john)/,'1').replace(/[\s.]/g,'');
}
export interface PassageRequest { translationId: string; reference?: string; bookId?: string; chapter?: number; fromVerse?: number; toVerse?: number }
export async function passage(request: PassageRequest) {
  const version = translation(request.translationId);
  const bible = await load(version.id);
  let { bookId, chapter, fromVerse, toVerse } = request;
  if (request.reference) {
    const match = /^([1-3]?\s*[A-Za-z][A-Za-z .]*?)\s*(\d{1,3})(?:\s*:\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?)?$/.exec(request.reference.trim());
    if (!match) throw AppError.badRequest('Use one chapter or verse range, such as John 3, John 3:16–18, or 1 John 1:9. For multiple chapters, use chapter navigation.');
    const candidate = normalizeBook(match[1]);
    bookId = bible.books.find(b => [b.name,b.id,...(abbreviations[b.id] ?? [])].some(n => normalizeBook(n) === candidate))?.id;
    if (!bookId) throw AppError.badRequest('Book not recognized. Choose a book and chapter below.');
    chapter = Number(match[2]); fromVerse = match[3] ? Number(match[3]) : undefined; toVerse = match[4] ? Number(match[4]) : fromVerse;
  }
  const index = bible.books.findIndex(b => b.id === bookId);
  if (index < 0) throw AppError.notFound('Bible book not found.');
  const book = bible.books[index]; const selected = book.chapters.find(c => c.number === chapter);
  if (!selected) throw AppError.notFound(`Choose a chapter from 1 to ${book.chapters.length} in ${book.name}.`);
  if ((fromVerse !== undefined && (fromVerse < 1 || fromVerse > selected.verses.length)) || (toVerse !== undefined && (toVerse < (fromVerse ?? 1) || toVerse > selected.verses.length))) throw AppError.badRequest(`Choose an ordered verse range from 1 to ${selected.verses.length}.`);
  const start = fromVerse ?? 1, end = toVerse ?? fromVerse ?? selected.verses.length;
  const previous = chapter! > 1 ? { bookId: book.id, chapter: chapter! - 1 } : index > 0 ? { bookId: bible.books[index-1].id, chapter: bible.books[index-1].chapters.length } : null;
  const next = chapter! < book.chapters.length ? { bookId: book.id, chapter: chapter! + 1 } : index < bible.books.length-1 ? { bookId: bible.books[index+1].id, chapter: 1 } : null;
  return { translation: version, book: { id: book.id, name: book.name }, chapter: chapter!, reference: `${book.name} ${chapter}${fromVerse !== undefined ? `:${start}${end !== start ? `–${end}` : ''}` : ''}`, fromVerse: fromVerse ?? null, toVerse: fromVerse !== undefined ? end : null,
    verses: selected.verses.filter(v => v.number >= start && v.number <= end).map(v => ({ ...v, note: v.text ? null : 'Verse text is not present in this edition.' })), previous, next };
}
