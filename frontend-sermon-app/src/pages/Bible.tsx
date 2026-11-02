import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import {
  YouVersionText,
  type YouVersionDisplay,
} from "../components/YouVersionText";
import { ErrorState, Loading, PageHeading } from "../ui";
interface Translation {
  id: string;
  name: string;
  abbreviation: string;
  attribution: string;
  sourceUrl: string;
  licence: string;
}
interface BibleBook {
  id: string;
  name: string;
  chapters: number;
}
interface ChapterLocation {
  bookId: string;
  chapter: number;
}
interface Passage {
  display?: YouVersionDisplay;
  translation: Translation;
  book: { id: string; name: string };
  chapter: number;
  reference: string;
  fromVerse: number | null;
  toVerse: number | null;
  verses: { number: number; text: string; note: string | null }[];
  previous: ChapterLocation | null;
  next: ChapterLocation | null;
}
function preference(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Reading still works when storage is blocked. */
  }
}
export function BibleLink({ reference }: { reference: string }) {
  return (
    <Link
      to={`/bible?reference=${encodeURIComponent(reference)}`}
      className="text-link text-xs inline-flex items-center gap-2"
    >
      <BookOpen size={14} />
      Read passage in Bible
    </Link>
  );
}
export function BibleReader() {
  const [params, setParams] = useSearchParams();
  const [preferred, setPreferred] = useState(() => {
    const saved = preference("onebody.bible.translation", "asv");
    return /^(asv|ylt|yv-[1-9]\d{0,9})$/.test(saved) ? saved : "asv";
  });
  const [fontSize, setFontSize] = useState(() => {
    const size = Number(preference("onebody.bible.fontSize", "20"));
    return Number.isInteger(size) && size >= 16 && size <= 28 ? size : 20;
  });
  const version = params.get("translation") ?? preferred;
  const reference = params.get("reference");
  const requestedBook = params.get("book") ?? "GEN",
    requestedChapter = params.get("chapter") ?? "1";
  const translations = useQuery({
    queryKey: ["bible-translations"],
    queryFn: () => api<Translation[]>("/bible/translations"),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const books = useQuery({
    queryKey: ["bible-books", version],
    queryFn: () =>
      api<BibleBook[]>(
        `/bible/books?translationId=${encodeURIComponent(version)}`,
      ),
  });
  const query = new URLSearchParams({ translationId: version });
  if (reference) query.set("reference", reference);
  else {
    query.set("bookId", requestedBook);
    query.set("chapter", requestedChapter);
    if (params.has("from")) query.set("fromVerse", params.get("from")!);
    if (params.has("to")) query.set("toVerse", params.get("to")!);
  }
  const passage = useQuery({
    queryKey: ["bible-passage", query.toString()],
    queryFn: () =>
      api<Passage>(`/bible/passages?${query}`, { cache: "no-store" }),
    staleTime: version.startsWith("yv-") ? 0 : undefined,
    gcTime: version.startsWith("yv-") ? 0 : undefined,
    refetchOnMount: version.startsWith("yv-") ? "always" : true,
  });
  const current = passage.data?.data;
  const currentBook = current?.book.id ?? (reference ? "GEN" : requestedBook);
  const currentChapter =
    current?.chapter ?? (reference ? 1 : Number(requestedChapter));
  const count =
    books.data?.data.find((b) => b.id === currentBook)?.chapters ?? 1;
  function navigate(location: ChapterLocation, translation = version) {
    setParams({
      translation,
      book: location.bookId,
      chapter: String(location.chapter),
    });
  }
  function switchVersion(value: string) {
    setPreferred(value);
    savePreference("onebody.bible.translation", value);
    const next = new URLSearchParams(params);
    next.set("translation", value);
    setParams(next);
  }
  function jump(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(
      new FormData(e.currentTarget).get("reference") ?? "",
    ).trim();
    if (value) setParams({ translation: version, reference: value });
  }
  return (
    <>
      <PageHeading
        eyebrow="THE WORD, EVERY DAY"
        title="A little time in Scripture."
      >
        Read a chapter, return to a promise, or follow a passage from your
        weekly study.
      </PageHeading>
      <section
        className="panel p-5 sm:p-6 mb-6 space-y-5"
        aria-label="Bible navigation"
      >
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,.65fr)]">
          <label className="field min-w-0">
            Translation
            <select
              className="w-full min-w-0"
              aria-label="Bible translation"
              value={version}
              onChange={(e) => switchVersion(e.target.value)}
              disabled={translations.isPending}
            >
              <option value="" disabled>
                Select translation
              </option>
              {translations.data?.data.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field min-w-0">
            Book
            <select
              className="w-full min-w-0"
              aria-label="Bible book"
              value={currentBook}
              onChange={(e) => navigate({ bookId: e.target.value, chapter: 1 })}
              disabled={!books.data}
            >
              <option value="" disabled>
                Select book
              </option>
              {books.data?.data.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field min-w-0">
            Chapter
            <select
              className="w-full min-w-0"
              aria-label="Bible chapter"
              value={currentChapter}
              onChange={(e) =>
                navigate({
                  bookId: currentBook,
                  chapter: Number(e.target.value),
                })
              }
              disabled={!books.data}
            >
              {Array.from({ length: count }, (_, i) => (
                <option value={i + 1} key={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        </div>
        {translations.data?.warning && (
          <p role="status" className="text-sm text-muted">
            {translations.data.warning}
          </p>
        )}
        {translations.isError && (
          <ErrorState
            error={translations.error}
            retry={() => void translations.refetch()}
          />
        )}
        {books.isError && (
          <ErrorState error={books.error} retry={() => void books.refetch()} />
        )}
        <form
          onSubmit={jump}
          className="search-input"
          key={reference ?? "chapter"}
        >
          <Search size={18} />
          <label className="sr-only" htmlFor="bible-reference">
            Passage reference
          </label>
          <input
            id="bible-reference"
            name="reference"
            placeholder="e.g. John 3:16–18 or 1 John 1:9"
            defaultValue={reference ?? ""}
            maxLength={160}
            required
          />
          <button className="text-link shrink-0" type="submit">
            Read passage
          </button>
        </form>
        <p className="text-xs text-muted leading-relaxed">
          ASV and YLT are public-domain editions. Other editions appear when
          available through our YouVersion licenses and require a connection.
          Use one chapter or a verse range within it; navigate between chapters
          below.
        </p>
      </section>
      {passage.isPending ? (
        <Loading label="Opening Scripture…" />
      ) : passage.isError ? (
        <div className="space-y-4">
          <ErrorState
            error={passage.error}
            retry={() => void passage.refetch()}
          />
          <p className="text-sm text-muted">
            If a linked reference contains several passages, choose a book and
            chapter above, or enter one reference at a time.
          </p>
          <button
            className="btn-secondary"
            onClick={() =>
              navigate(
                { bookId: "GEN", chapter: 1 },
                ["asv", "ylt"].includes(version) ? version : "asv",
              )
            }
          >
            Open Genesis 1
          </button>
        </div>
      ) : (
        current && (
          <>
            <article className="panel p-6 sm:p-10" aria-label="Bible passage">
              <header className="flex flex-wrap justify-between gap-5 items-center border-b border-line pb-6 mb-7">
                <div>
                  <span className="badge">
                    {current.translation.abbreviation}
                  </span>
                  <h2 className="font-serif text-3xl sm:text-4xl mt-3">
                    {current.reference}
                  </h2>
                  {current.fromVerse !== null && (
                    <button
                      className="text-link text-xs mt-3"
                      onClick={() =>
                        navigate({
                          bookId: current.book.id,
                          chapter: current.chapter,
                        })
                      }
                    >
                      Read whole chapter
                    </button>
                  )}
                </div>
                <label className="field" htmlFor="bible-font">
                  Text size: {fontSize}px
                  <input
                    id="bible-font"
                    type="range"
                    min={16}
                    max={28}
                    step={2}
                    value={fontSize}
                    onChange={(e) => {
                      const size = Number(e.target.value);
                      setFontSize(size);
                      savePreference("onebody.bible.fontSize", String(size));
                    }}
                  />
                </label>
              </header>
              {current.display ? (
                <YouVersionText display={current.display} fontSize={fontSize} />
              ) : (
                <div
                  className="bible-text font-serif text-reading"
                  style={{ fontSize }}
                >
                  {current.verses.map((v) => (
                    <p key={v.number} className="mb-5" data-verse={v.number}>
                      <sup
                        className="text-accent font-sans text-[11px] font-semibold mr-2"
                        aria-label={`Verse ${v.number}`}
                      >
                        {v.number}
                      </sup>
                      {v.text || (
                        <span className="font-sans italic text-sm text-muted">
                          {v.note}
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              )}
              <footer className="mt-8 pt-5 border-t border-line text-xs text-muted space-y-2">
                <p>{current.translation.attribution}</p>
                <p>
                  Text edition:{" "}
                  <a
                    className="text-link"
                    href={current.translation.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source and provenance
                  </a>
                </p>
              </footer>
            </article>
            <nav
              className="flex flex-wrap justify-between gap-3 mt-6"
              aria-label="Chapter navigation"
            >
              <button
                className="btn-secondary"
                disabled={!current.previous}
                onClick={() => current.previous && navigate(current.previous)}
              >
                <ArrowLeft size={16} />
                Previous chapter
              </button>
              <button
                className="btn-primary"
                disabled={!current.next}
                onClick={() => current.next && navigate(current.next)}
              >
                Next chapter
                <ArrowRight size={16} />
              </button>
            </nav>
          </>
        )
      )}
    </>
  );
}
