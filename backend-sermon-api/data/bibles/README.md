# Bundled public-domain Bible editions

Only these two English editions are included:

- **ASV — American Standard Version (1901)**, public-domain translation.
- **YLT — Young's Literal Translation (1898)**, Robert Young's public-domain translation.

Each contains the standard 66-book Protestant canon, 1,189 chapters, and 31,102 numbered verse records. ASV has 16 empty verse records in this source edition. Those records retain their numbers and empty text; the reader shows a separate explanatory note, never substituted text from a different translation.

## Provenance and redistribution

Source: [Scrollmapper bible_databases](https://github.com/scrollmapper/bible_databases), pinned to commit `59b18c5af5845728c275d5b7178ad0d024172b1f`.

The exact source URLs, downloaded source SHA-256 digests, and packaged SHA-256 digests are recorded in `manifest.json`. The upstream collection's MIT notice is retained in `LICENSE.scrollmapper.txt`. These historical translation texts are public domain; this is not a blanket permission to add every translation from that collection. Modern copyrighted editions require separate rights/provider configuration and are not offered by this app.

The app retains the source verse text verbatim. Packaging normalizes book IDs to stable USFM-style identifiers, changes Roman-numeral book display prefixes to Arabic numerals, labels Revelation consistently, and stores chapter/verse numbers as `number`. UTF-8 JSON is minified and gzip-compressed with deterministic metadata. No verses are translated, paraphrased, or filled in. The runtime verifies packaged checksums before serving an edition. The existing source name "Song of Solomon" also resolves through the "Song of Songs" alias.

Include this entire directory in backend deployment artifacts alongside `dist/`. Node reads the files server-side; they are not imported into the React bundle, placed in `public/`, or precached by the service worker. The backend keeps verified editions in process memory after their first request. There is no runtime Bible-provider API key or remote service dependency.

For an intentional future data update, retrieve the pinned/approved source over verified HTTPS, verify its revision and translation rights, preserve the license notice and exact verse text, validate all book/chapter/verse numbering, and review new source/package digests together. Do not replace expected digests to bypass a failed integrity check. `scripts/bible-test.mjs` validates corpus hashes/counts, representative verses in both editions, omission notes, references and navigation.
