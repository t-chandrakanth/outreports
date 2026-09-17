# SCR Out Reports — PWA

Mobile-first, installable, offline-capable web app for South Central Railway
TMR outreport entry. Data lives in the existing shared Google Spreadsheet;
the app talks to it through the Google Apps Script JSON API in
`apps-script/Code.gs`.

## How it fits together

```
Phone / desktop browser
   └── PWA on Vercel (this repo, static Vite+React build)
         └── fetch → Apps Script /exec URL (JSON API, CORS-safe)
               └── Google Spreadsheet (one tab per direction, shared team-wide)
```

- **Offline**: new entries are queued on the device (IndexedDB) and sync
  automatically when connection returns; the saved list falls back to the
  last-fetched copy with an "as of" banner.
- **Row identity**: every row gets a UUID in the `_ID` column (auto-created,
  auto-backfilled). Edits and deletes address rows by id — safe with
  concurrent users. **Do not rename sheet column headers or delete the `_ID`
  column.** If a tab's header is spelled differently (today: `RAKE-ID` on a
  few tabs instead of `RAKE-ID (IF-CC RAKE)`), add the spelling to
  `HEADER_ALIASES` in both `apps-script/Code.gs` and `src/config.ts` rather
  than editing the sheet; the API returns canonical headers either way.
- **Delete PIN**: deletes are validated server-side against the
  `DELETE_PIN` Script Property.
- The old Apps Script web app UI keeps working at its original URL.
  Known limitation kept for compatibility: the legacy UI deletes by row
  number, so if two people delete from it at the same moment the wrong row
  can be removed (this has always been true). The PWA deletes by `_ID` and
  is not affected — prefer the PWA for deletes.

## One-time backend setup (Apps Script)

1. Open the spreadsheet → Extensions → Apps Script.
2. Note the name of the HTML file in the left sidebar (e.g. `Index`).
3. Open `Code.gs`, select all, paste the contents of
   [`apps-script/Code.gs`](apps-script/Code.gs), and set the
   `LEGACY_HTML_FILE` constant at the top to the HTML file's name. Save.
4. Project Settings (gear) → Script Properties → add `DELETE_PIN` = your PIN.
5. **Deploy → Manage deployments → select the Web app → pencil (Edit) →
   Version: “New version” → Deploy.**
   Never use “New deployment” — that creates a *different* URL.
6. In the same dialog confirm: Execute as **Me**, Who has access **Anyone**
   (plain “Anyone”, not “Anyone with Google account”).
7. Test: open `<EXEC_URL>?action=ping` → should show `{"ok":true,"version":3}`.

To change the PIN later: edit the `DELETE_PIN` Script Property (no redeploy
needed).

To add a location (new sheet tab): create the tab (an empty tab is fine — the
backend writes the standard header row on first use; if you fill it yourself,
use the same header row as the others), add its name to `ALLOWED_SHEETS` in
`apps-script/Code.gs`, redeploy (step 5), then add it to `LOCATIONS` in
`src/config.ts`. Deploy the backend first — the app rejects saves to tabs the
backend does not list.

To rename a tab: rename it in the sheet, update `ALLOWED_SHEETS` and
`LOCATIONS`, and add `old name → new name` to `SHEET_ALIASES` in
`apps-script/Code.gs`, `src/config.ts` and `scripts/mock-apps-script.mjs`.
Installed apps and offline-queued entries keep sending the old name until they
update, and the alias keeps them working.

Current tiles and tabs (the app shows each tab as an Up/Down direction under
its tile; the tab name is only used for the API):

| Tile | Up | Down | Other |
|---|---|---|---|
| WADI | `SNF-WADI/CT UP` | `WADI/CT-SNF DN` | |
| MTMI | `DKJ-MTMI/VNUP UP` | `MTMI-DKJ DN` | `VNUP-MTMI` |
| BPQ | `BPA-BPQ UP` | `BPQ-BPA DN` | |
| NZB | `NZB-RDM UP` | `RDM-NZB DN` | |
| SNF | `SNF-KZJ` | `KZJ-SNF` | |
| BDCR | `BDCR-DKJ` | `DKJ-BDCR` | |
| BIDR | `VKB-BIDR-PRLI/LTRR` | `PRLI/LTRR-BIDR-VKB` | |
| RC | `RC-CT/WADI UP` | `RC-WADI/CT DN` | |
| HYB | | `HYB-DN` | |
| VNUP-PGDP-SNF | | | `VNUP-PGDP-SNF` |

`Sheet12` in the workbook is a hand-made archive of older rows and is
deliberately not listed.

The legacy Apps Script UI lives in `apps-script/Index.html` (paste it over the
`Index` HTML file in the editor whenever the station list changes); it calls
`saveRecord`, `updateRecord` and `getSheetData` in `Code.gs`, which share the
JSON API's validation, ids and header aliases.

## Development

```bash
npm install
cp .env.example .env.local     # put the real /exec URL in VITE_APPS_SCRIPT_URL
npm run dev                    # dev server
npm test                       # unit tests (vitest)
npm run build && npm run preview   # production build + local preview
```

`node scripts/mock-apps-script.mjs` starts a local mock of the Apps Script
transport (port 8787, delete PIN `1234`) for testing without touching the
real sheet: build with `VITE_APPS_SCRIPT_URL=http://localhost:8787/exec`.

## Icons & splash

The brand sources live in `assets/`: `LOGO.png` (train emblem over the
wordmark, transparent) and `Splshscreen.png` (the splash photo). Everything
the phone shows is rendered from those two files:

```bash
npm run icons   # after replacing either source file
```

- `public/favicon.png`, `public/icons/icon-192.png`, `icon-512.png` — the
  emblem (the logo with the wordmark cropped off) on a white rounded square.
  `maskable-512.png` keeps the emblem inside Android's 80% safe zone;
  `apple-touch-icon.png` is full-bleed because iOS rounds it itself.
  The same `icon-192.png` is the badge next to the title on the home screen.
- `public/splash/splash.webp` — the in-app splash. `index.html` paints it
  full-screen before any JavaScript loads and `src/splash.ts` fades it out
  after the first render (never sooner than 600 ms after page start).
- `public/splash/ios/*.png` — one `apple-touch-startup-image` per iPhone/iPad
  size, referenced from `index.html` with a device media query (the script
  prints that block). Only the installed home-screen app shows these. They
  are excluded from the service-worker precache; Safari fetches just the one
  it needs. Android builds its own splash from the manifest icon and
  `background_color`, so nothing custom is possible there.

## Deploying to Vercel

`VITE_*` variables are baked in at **build time** — changing one requires a
redeploy.

```bash
vercel link                                      # once
vercel env add VITE_APPS_SCRIPT_URL production   # once (paste the /exec URL)
vercel --prod                                    # every deploy
```

## Languages

The UI is available in English, Telugu (తెలుగు) and Hindi (हिन्दी). Users
switch from the globe button in the app bar; the choice is stored on the
device. A first visit follows the phone's language when it is Telugu or
Hindi, otherwise English.

- Strings live in `src/i18n/locales/`. `en.ts` is the schema. `te.ts` and
  `hi.ts` are typed against it, so a missing key fails `npm run build`, and
  `npm test` checks that every `{{variable}}` and `<b>` tag is kept.
- To add a string, add the key to all three files and use
  `const { t } = useTranslation()` then `t('section.key')`.
- Not translated on purpose: sheet names, location codes, sheet column
  headers, the app name, and the WhatsApp share text (the team channel reads
  English). Browser button names in the install guide stay English because
  that is what most phones show.
- Server error messages are translated by error code in `src/i18n/errors.ts`;
  `VALIDATION` and `INTERNAL` show the server's own text.

## Analytics

The production build loads [Vercel Web Analytics](https://vercel.com/docs/analytics)
and [Speed Insights](https://vercel.com/docs/speed-insights) through
`src/analytics.ts`. Dev builds, the mock backend and tests send nothing.

One-time setup: in the Vercel dashboard open the project, then enable
**Analytics** and **Speed Insights**. Custom events need a plan that includes
them; on a plan without them, page views and Web Vitals still work.

Custom events (properties never include record contents, numbers, PINs or ids):

| Event | Properties |
|---|---|
| `outreport_saved` | `sheet`, `mode` (`online` / `queued`) |
| `outreport_updated` | `sheet`, `queued` |
| `outreport_deleted` | `sheet` |
| `queue_synced` | `delivered`, `stopped` |
| `queue_failed` | `failed`, `stopped` |
| `language_changed` | `from`, `to` |
| `install_prompted` / `install_accepted` | `platform` |
| `client_error` | `name`, `message` (truncated, digit runs masked), `source` |

## Security model

Anyone with the app (or Apps Script) URL can view and add outreports —
matching how the original app worked. Deletes need the shared PIN. If the
URL ever leaks and abuse occurs, add a shared app key: put an `APP_KEY`
Script Property check at the top of `route()` in Code.gs, send the key in
every request body from `src/api/client.ts`, and redeploy both.
