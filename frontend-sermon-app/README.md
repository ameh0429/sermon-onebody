# OneBody web app

React + TypeScript + Vite, Tailwind CSS, React Router, and TanStack Query. A responsive member app for account registration/login/profile, the sermon library and audio/video, and daily study plans with saved progress. Includes installable PWA support.

## Start locally

Requires Node **20.19+ or 22.12+** (tested with Node 24), npm, and the existing backend/PostgreSQL development setup.

In a terminal at the repository root:

```bash
cd backend-sermon-api
npm ci
# Configure .env using .env.example; start PostgreSQL first.
# Use DB_SYNC=true to create/update development tables.
npm run dev
```

In a second terminal at the repository root:

```bash
cd frontend-sermon-app
npm ci
npm run dev
```

Open **http://localhost:5173**. The Vite proxy forwards `/api` to the backend on port 3000. To use a different local backend port, set `API_PROXY_TARGET` in the frontend process environment before starting Vite. For example, in Bash: `API_PROXY_TARGET=http://127.0.0.1:3001 npm run dev`.

The frontend requires the backend changes in this branch, including `GET /api/v1/study-plans`. There is no demo mode or seeded production content. Register a member, then use an admin/pastor account through Swagger to create published sermons and attach plans. Unpublished/unattached plans are omitted from the member Growth catalog. Empty libraries have helpful empty states.

## Features

- Registration, login, password visibility toggle, account profile and sign out. Profile displays API account information; editing account details is not part of this version.
- Search sermons by text/passage, preacher, tag, date range, and date ordering; pagination, readable sermon details, optional native audio/video controls, and YouTube embeds.
- Study plan catalog/search/pagination; plans linked from sermons; daily lessons, scripture references, progress summaries, complete/reset actions, and next-day navigation. Completion is confirmed by the API and saved per user in PostgreSQL.
- Responsive navigation: bottom tabs on phones/tablets and sidebar on desktop. Keyboard focus indicators, labelled forms, status/error feedback, reduced-motion support, and accessible progress controls.
- View events are recorded when opening a published sermon; listen events are recorded when playing its native audio. External embedded video playback is not counted as an audio listen. The API deduplicates engagement.

## Authentication and privacy

Bearer tokens stay **only in memory**. Refreshing, closing the app, or applying an app update signs the user out. Tokens are not persisted to localStorage, sessionStorage, IndexedDB, service-worker caches, or URLs. A 401 clears the session and query cache; explicit sign-out also clears both. Profile refresh gets current account data from `/users/me`.

Use HTTPS in production. A persistent-login feature should use a separately designed backend session/refresh flow with secure HttpOnly cookies and appropriate CSRF protection, rather than storing long-lived bearer tokens in browser storage. Do not put database/JWT/admin secrets in frontend `.env` files: `VITE_*` values are public build-time configuration.

## API address and deployment

Default: `/api/v1` (same origin). For a separately hosted API, copy `.env.example` to `.env.local` and set the public URL:

```dotenv
VITE_API_BASE_URL=https://your-api.example.com/api/v1
```

Allow the frontend origin in the backend's `CORS_ORIGIN`. Rebuild after changing frontend environment variables.

```bash
npm run build
npm run preview
```

Publish `dist/` to an HTTPS static host. Configure SPA fallback to `index.html` for `/login`, `/register`, `/sermons/*`, `/growth/*`, and `/profile`. When using the same-origin API address, configure an API reverse proxy before the SPA fallback; the Vite development proxy is not a production server. When using a separate API URL, only the SPA fallback is needed on the static host. Your media URLs must be publicly playable HTTPS resources with supported formats; YouTube watch/share URLs are embedded with the privacy-enhanced player. Playback failures provide a source link. Browsers may block insecure media on an HTTPS page.

## PWA

Production builds generate a web manifest, icons and a service worker. The profile screen offers installation where supported and instructions for Safari's Share → Add to Home Screen. Mobile installation requires HTTPS; localhost works for development checks. PWA generation is enabled in builds, not the normal Vite dev server; use `npm run build && npm run preview` to test it.

The service worker caches **only the application shell/assets**. Authenticated API data, lessons, media, and progress are not cached for offline use. An offline banner explains that signing in/loading/saving requires connectivity. New versions prompt the user before reloading; updating ends the in-memory login session. Phone installation UI varies by browser; it is not a separate Android or iOS application.

## Browser tests

Install the backend and frontend dependencies, prepare a **local development database with all current tables**, and ensure backend `.env` has `DATABASE_URL` and `JWT_SECRET` (or supply them in the test process). The runner reads that backend env file without copying secrets to the frontend bundle. It starts its own API on port 3010 with `DB_SYNC=false` and a production preview on port 5174; leave these ports free.

```bash
npx playwright install chromium
npm run test:e2e
```

For an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its path instead of downloading a browser. Tests reject non-local database URLs, create uniquely identified fixtures, and clean up their own users/sermons/plans. Keep a single worker so the real authentication rate limit is respected. No assertions or rate limits are bypassed.

Coverage: registration/login/profile/logout; real API search and progress; native audio/video playback with local test media, media failure feedback, and YouTube embed selection; errors/retry/session expiry; 390px, 768px, and 1440px layouts; protected/paginated published-plan listing; and manifest/service-worker/offline shell. External media host availability and device-specific installation dialogs require device testing. Screenshots and traces are written to ignored `test-results/`; traces may contain test-session requests and must not be published as production artifacts.

## Personal, fellowship, and dashboard screens

- **Personal**: save/remove sermon bookmarks, write/edit/delete private journal entries, and optionally connect a reflection to a sermon. The message page has bookmark and journal shortcuts. Existing shared entries carry a warning: saving in this private editor removes their sharing. No journal drafts or private content are stored offline or in browser storage; only explicitly saved entries reach the API.
- **Fellowship**: browse/search groups or filter to your groups, join/leave, view the member list, post discussions/replies, optionally connect threads to sermons, filter discussions by sermon, and report posts. Authors can delete their own posts. The group leader and admins can edit/delete the group and review/delete flagged posts. Replies stay one level deep, matching the API. Leaving a group removes discussion access.
- **Dashboard**: available to pastors (`leader`) and admins. Create/edit/publish/archive/delete sermons; create/edit/delete study plans, attach/move them to sermons, and manage lessons for days 1–7. Staff can see draft/archived/unattached plans in management while the member catalog stays limited to published content. Media URLs and lesson scripture can be cleared through the editors. Deleting content requires confirmation and explains affected records.
- **Analytics**: lifetime aggregate counts, accessible to pastors/admins, with no private journal content or individual progress disclosed.
- **Accounts**: admin-only paginated users, role assignment, deactivation/reactivation, immediate backend enforcement, and disabled self-deactivation/self-role controls. Pastor accounts cannot access account management.

Mobile bottom navigation now includes Personal and Groups; staff gets Dashboard, with profile reachable through the avatar. Desktop navigation includes every permitted section. Content editors and account cards adapt to narrow screens.

`npm run test:e2e` runs the member and community/dashboard suites sequentially, each against a fresh API process. This preserves the real authentication rate limit without disabling it. The community suite checks bookmark removal (204), private journal CRUD and cross-user/admin privacy, failed-save retention, membership and discussions/replies/reporting, moderation and group management, sermon/plan/lesson management, analytics, account roles/deactivation, and route/API access restrictions. Test data stays in the local development database and is removed after the suites. Use the same setup steps described above; no new services or schema migrations are required for these screens.

## Appearance

Users can choose **Light**, **Dark**, or **System** only under their profile. Sign-in and registration still use the saved/system theme, but do not show appearance controls. System is the default and follows device changes while the app is open. An explicit choice is remembered for this browser under the non-sensitive `onebody.theme` localStorage key, survives sign-out/reloads, and synchronizes across tabs. This setting is device-specific, not attached to an account. If storage is blocked, switching still works for the current page.

`public/theme.js` applies the saved/system preference before React and styles load, avoiding a flash of the wrong theme. `src/theme.tsx` provides the shared React control and handles system/storage changes. Semantic Tailwind color tokens in `styles.css` cover surfaces, text, navigation, forms, reading content, dashboard panels and feedback. `color-scheme` also adapts native controls, and the browser theme-color follows the resolved appearance. The PWA includes the bootstrap script in its app-shell cache.

The theme browser tests cover device defaults/live changes, explicit overrides, reload persistence, tab synchronization, invalid/blocked storage, and initialization before React. Existing member and dashboard workflows also exercise theme switching. Only the theme preference is stored locally; authentication tokens and private content remain in memory/server storage as described above.

## Profile photos

The Profile screen now includes photo selection, a square preview, explicit upload, cancel, replacement and confirmed removal. Supported inputs are still JPEG/PNG/WebP up to 5 MiB. The backend validates and processes the actual image; metadata is removed and the final photo is 400×400 JPEG. Existing photos remain unchanged if an upload fails. Broken or missing images fall back to the user's initial. A shared Avatar component updates the profile, sidebar and mobile header after a successful response, without signing in again.

Photos are public Cloudinary URLs. The image selection preview uses a temporary object URL that is released when selection changes or the editor closes; original files and previews are not stored in browser storage or service-worker caches. Uploads require connectivity. Tokens continue to stay only in memory, and multipart uploads use the existing bearer-authenticated API client without overriding the browser's multipart boundary.

Backend setup is required: apply `migrations/20261031_profile_photos.sql` and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` securely on the **backend only**. See the backend README. Missing configuration produces an explanatory error while leaving the previous photo intact. There are no Cloudinary secrets or direct unsigned upload presets in the frontend.

The browser suite includes `photo.spec.ts` for preview/cancel, multipart requests, replacement/removal, phone/dark layouts, validation, failed uploads, image fallback and session expiration. Storage responses are explicitly intercepted in those UI tests; backend `scripts/avatar-test.mjs` tests the real multipart/transaction pipeline with an injected storage stand-in. Neither suite verifies live Cloudinary connectivity or credentials.
