# SCR TMR'S OUTREPORTS — PWA

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
  column.**
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
7. Test: open `<EXEC_URL>?action=ping` → should show `{"ok":true,"version":1}`.

To change the PIN later: edit the `DELETE_PIN` Script Property (no redeploy
needed).

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

## Deploying to Vercel

`VITE_*` variables are baked in at **build time** — changing one requires a
redeploy.

```bash
vercel link                                      # once
vercel env add VITE_APPS_SCRIPT_URL production   # once (paste the /exec URL)
vercel --prod                                    # every deploy
```

## Security model

Anyone with the app (or Apps Script) URL can view and add outreports —
matching how the original app worked. Deletes need the shared PIN. If the
URL ever leaks and abuse occurs, add a shared app key: put an `APP_KEY`
Script Property check at the top of `route()` in Code.gs, send the key in
every request body from `src/api/client.ts`, and redeploy both.
