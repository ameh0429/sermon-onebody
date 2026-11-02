import {
  ApiClient,
  BibleClient,
  getHttpStatus,
} from "@youversion/platform-core";
import { z } from "zod";
import { AppError } from "../utils/AppError.js";
import { resolvePassageRequest, type PassageRequest } from "./bible.js";

const versionSchema = z.object({
  id: z.number().int().positive(),
  abbreviation: z.string(),
  title: z.string(),
  language_tag: z.string(),
});
const collectionSchema = z.object({
  data: z.array(versionSchema),
  next_page_token: z.string().optional(),
});
const indexSchema = z.object({
  books: z.array(
    z.object({
      id: z.string().regex(/^[1-3]?[A-Z]{2,3}$/),
      title: z.string(),
      chapters: z.array(
        z.object({
          id: z.string().regex(/^[1-9]\d*$/),
          verses: z.array(z.object({ id: z.string().regex(/^[1-9]\d*$/) })),
        }),
      ),
    }),
  ),
});

// No passage text or attribution is cached here. The SDK fetches current attribution
// on every getPassageDisplay call and refuses to display text without it.
export class YouVersion {
  private api: ApiClient;
  private bible: BibleClient;
  constructor(appKey: string) {
    this.api = new ApiClient({ appKey, timeout: 10_000 });
    this.bible = new BibleClient(this.api);
  }
  private async safely<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof AppError) throw error;
      const status = getHttpStatus(error);
      if (status === 403 || status === 401)
        throw new AppError(
          503,
          "YouVersion access is unavailable. Check the App Key and accepted licenses. ASV and YLT remain available.",
        );
      if (status === 404)
        throw AppError.notFound(
          "This Bible passage is not available in the selected YouVersion edition.",
        );
      // Do not expose upstream errors: SDK messages can contain request URLs.
      throw new AppError(
        503,
        "YouVersion is temporarily unavailable. Try again or choose ASV or YLT.",
      );
    }
  }
  async translations() {
    return this.safely(async () => {
      const found = new Map<number, z.infer<typeof versionSchema>>();
      const tokens = new Set<string>();
      let token: string | undefined;
      for (let page = 0; page < 30; page++) {
        const raw = await this.api.get<unknown>("/v1/bibles", {
          "language_ranges[]": ["en"],
          all_available: false,
          page_size: 99,
          ...(token ? { page_token: token } : {}),
        });
        // SDK returns undefined for a 204 response.
        if (raw === undefined || raw === null || raw === "") break;
        const result = collectionSchema.parse(raw);
        for (const version of result.data)
          if (/^en(?:-|$)/i.test(version.language_tag))
            found.set(version.id, version);
        token = result.next_page_token;
        if (!token) break;
        if (tokens.has(token) || page === 29)
          throw new Error("Invalid collection pagination");
        tokens.add(token);
      }
      return [...found.values()].map((v) => ({
        id: `yv-${v.id}`,
        abbreviation: v.abbreviation,
        name: v.title,
        language: "English",
        provider: "youversion",
        attribution: "",
        sourceUrl: `https://www.bible.com/versions/${v.id}`,
        licence: "YouVersion publisher license",
      }));
    });
  }
  private async authorized(id: string) {
    const version = (await this.translations()).find((v) => v.id === id);
    if (!version)
      throw AppError.forbidden(
        "This translation is not available under the app’s current YouVersion licenses. Choose another translation.",
      );
    return Number(id.slice(3));
  }
  private async index(id: number) {
    return indexSchema.parse(await this.bible.getIndex(id)).books.map((b) => ({
      id: b.id,
      name: b.title,
      chapters: b.chapters.map((c) => ({
        number: Number(c.id),
        verses: c.verses.map((v) => Number(v.id)),
      })),
    }));
  }
  async books(id: string) {
    return this.safely(async () =>
      (await this.index(await this.authorized(id))).map((b) => ({
        id: b.id,
        name: b.name,
        chapters: b.chapters.length,
      })),
    );
  }
  async chapters(id: string, bookId: string) {
    return this.safely(async () => {
      const book = (await this.index(await this.authorized(id))).find(
        (b) => b.id === bookId,
      );
      if (!book)
        throw AppError.notFound("Bible book not found in this edition.");
      return book.chapters.map((c) => ({
        number: c.number,
        verses: c.verses.length,
      }));
    });
  }
  async passage(request: PassageRequest) {
    return this.safely(async () => {
      const id = await this.authorized(request.translationId);
      const books = await this.index(id);
      const { bookId, chapter, fromVerse, toVerse } = resolvePassageRequest(
        request,
        books,
      );
      const position = books.findIndex((b) => b.id === bookId);
      const book = books[position];
      if (!book)
        throw AppError.notFound("Bible book not found in this edition.");
      const selected = book.chapters.find((c) => c.number === chapter);
      if (!selected)
        throw AppError.notFound("Chapter not found in this edition.");
      const end = toVerse ?? fromVerse;
      if (
        fromVerse !== undefined &&
        (!selected.verses.includes(fromVerse) ||
          !selected.verses.includes(end!) ||
          end! < fromVerse)
      )
        throw AppError.badRequest(
          "Choose an ordered verse range available in this edition.",
        );
      const passageId = `${book.id}.${chapter}${fromVerse !== undefined ? `.${fromVerse}${end !== fromVerse ? `-${end}` : ""}` : ""}`;
      const display = await this.bible.getPassageDisplay({
        versionId: id,
        passageId,
        includeHeadings: true,
        includeNotes: true,
      });
      const previous =
        chapter! > 1
          ? { bookId: book.id, chapter: chapter! - 1 }
          : position > 0
            ? {
                bookId: books[position - 1].id,
                chapter: books[position - 1].chapters.at(-1)!.number,
              }
            : null;
      const next =
        chapter! < book.chapters.length
          ? { bookId: book.id, chapter: chapter! + 1 }
          : position < books.length - 1
            ? { bookId: books[position + 1].id, chapter: 1 }
            : null;
      return {
        translation: {
          id: request.translationId,
          abbreviation: display.version.abbreviation,
          name: display.version.title,
          language: "English",
          provider: "youversion",
          attribution: display.attribution.text,
          sourceUrl: `https://www.bible.com/versions/${id}`,
          licence: "YouVersion publisher license",
        },
        book: { id: book.id, name: book.name },
        chapter: chapter!,
        reference: `${book.name} ${chapter}${fromVerse !== undefined ? `:${fromVerse}${end !== fromVerse ? `–${end}` : ""}` : ""}`,
        fromVerse: fromVerse ?? null,
        toVerse: end ?? null,
        verses: [],
        previous,
        next,
        display: {
          html: display.html,
          stylesheets: display.stylesheets,
          containerAttributes: display.containerAttributes,
        },
      };
    });
  }
}

// Read at request time so dotenv initialization order does not disable the adapter.
export function youVersion() {
  const key =
    process.env.YVP_APP_KEY?.trim() || process.env.YOUVERSION_APP_KEY?.trim();
  return key ? new YouVersion(key) : null;
}
export function requireYouVersion() {
  const provider = youVersion();
  if (!provider)
    throw new AppError(503, "YouVersion is not configured. Choose ASV or YLT.");
  return provider;
}
