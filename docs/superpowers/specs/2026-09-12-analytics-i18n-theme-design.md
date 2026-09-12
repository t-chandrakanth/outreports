# OUTREPORTS: Vercel Analytics, three-language UI, Chakra Teal theme, Apple-style font

Date: 2026-09-12
Status: approved design, awaiting implementation plan

## Goal

Four additions to the existing Vite + React 18 + MUI 7 PWA, delivered as
four independent, individually shippable steps:

1. Vercel Web Analytics and Speed Insights, with named custom events and
   client-error reporting.
2. User-selectable UI language: English, Telugu, Hindi, switched from the
   app bar on every screen, persisted per device.
3. Colour theme restyled to Chakra UI's default colour tokens with Teal as
   the primary colour, keeping MUI as the component library.
4. Apple-style typography: San Francisco on Apple devices (already the case
   via `-apple-system`), self-hosted Inter everywhere else.

## Decisions already made (with the user)

| Question | Decision |
|---|---|
| Chakra scope | Keep MUI; adopt Chakra's colour tokens, radii and shadows. No component-library migration. |
| Primary colour | Chakra Teal. |
| "Vercel logging" | `@vercel/analytics` + `@vercel/speed-insights` + custom events. No serverless log endpoint. |
| Non-Apple font | Bundle Inter (woff2, self-hosted, precached by the service worker). |
| i18n library | `react-i18next` + `i18next` (user's choice over a custom module). |
| WhatsApp share text | Stays English regardless of UI language (shared team channel). |

## Out of scope

- Any change to `apps-script/Code.gs` or the Google Sheet. The backend keeps
  returning English messages; the client translates by error code.
- Translating sheet names, location codes, or sheet column headers. These are
  record keys and identifiers.
- Dark mode.
- A serverless `/api/log` function.

---

## 1. Analytics and events

### Packages

`@vercel/analytics` and `@vercel/speed-insights` (current stable). Both are
initialised once in `src/main.tsx` via a new module `src/analytics.ts`.

### `src/analytics.ts`

```ts
export function initAnalytics(): void      // no-op unless import.meta.env.PROD
export function trackEvent(name: EventName, props?: Record<string, string | number | boolean>): void
export type EventName =
  | 'outreport_saved'      // props: { sheet, mode: 'online' | 'queued' }
  | 'outreport_updated'    // props: { sheet, queued: boolean }
  | 'outreport_deleted'    // props: { sheet }
  | 'queue_synced'         // props: { delivered: number }
  | 'queue_failed'         // props: { failed: number, stopped: boolean }
  | 'language_changed'     // props: { from, to }
  | 'install_prompted'     // props: { platform }
  | 'install_accepted'     // props: { platform }
  | 'client_error';        // props: { name, message, source: 'error' | 'unhandledrejection' }
```

Rules:

- `trackEvent` wraps the Vercel `track()` call in try/catch and never throws.
  Analytics failing (offline, ad-blocker, script not loaded) must never affect
  saving, syncing or navigation.
- Outside production (`import.meta.env.PROD === false`) both functions are
  no-ops, so `npm run dev`, the mock backend and vitest never send beacons.
- `initAnalytics` also registers `window.onerror` and
  `unhandledrejection` listeners that emit `client_error`. Only the error
  `name` and `message` (truncated to 200 chars) are sent.
- **Privacy invariant:** event properties never contain record contents,
  train numbers, mobile numbers, PIN values or record ids. Sheet names and
  counts only.

### Call sites

| Event | Where |
|---|---|
| `outreport_saved` | `EntryForm.submit`, both the online success path and every enqueue path |
| `outreport_updated` | `EntryForm.submit`, edit branches |
| `outreport_deleted` | `SavedList.confirmDelete` success |
| `queue_synced` / `queue_failed` | `SyncBadge.syncNow` and the automatic flush in `App.tsx` (wrap `flushOutbox` result once in a helper so both paths report) |
| `language_changed` | the language switcher |
| `install_prompted` / `install_accepted` | `InstallGuide.install` |

### Service worker

Add a `NetworkOnly` runtime-caching rule in `vite.config.ts` for
`/_vercel/insights/` and `/_vercel/speed-insights/` so the analytics script
and beacons are never served stale or intercepted.

### Vercel project

Web Analytics and Speed Insights must be enabled in the Vercel dashboard for
the project. This is a one-time manual step and is documented in the README.

---

## 2. Languages

### Library and setup

- `i18next`, `react-i18next`. No language-detector plugin; detection is a
  ten-line function (below) so behaviour stays explicit.
- Resources are bundled statically (no HTTP backend) so the app works
  offline. Three dictionaries live in `src/i18n/locales/{en,te,hi}.ts`,
  each exporting a plain object.
- `src/i18n/index.ts` initialises i18next with `resources`, `lng` from
  detection, `fallbackLng: 'en'`, `interpolation.escapeValue: false` (React
  escapes), and `returnNull: false`.
- **Type safety:** `src/i18n/i18next.d.ts` augments `CustomTypeOptions` with
  `resources: { translation: typeof en }`. `te.ts` and `hi.ts` are declared
  as `const te: typeof en = { ... }`, so a missing or extra key fails
  `tsc --noEmit`, which runs as part of `npm run build`.
- Plurals use i18next's `_one` / `_other` suffixes (CLDR: English, Telugu and
  Hindi all have exactly these two categories). i18next's Intl.PluralRules
  path is used; no JSON-v3 compatibility shim.

### Detection and persistence

```
stored = localStorage['outreports:lang']  (try/catch; ignore failures)
if stored in {en, te, hi} -> stored
else if navigator.language starts with 'te' -> 'te'
else if navigator.language starts with 'hi' -> 'hi'
else -> 'en'
```

On change: `i18n.changeLanguage(code)`, write localStorage,
set `document.documentElement.lang = code`, emit `language_changed`.
`index.html` keeps `lang="en"` as the pre-hydration default.

### What is translated

All user-visible text in the client:

- Screen titles and subtitles other than the fixed brand title
  `SCR TMR'S OUTREPORTS` (the subtitle `SOUTH CENTRAL RAILWAY` is translated).
- Tabs, buttons, dialog titles and bodies, toasts, empty states, loading and
  error states, the offline "as of" banner, the sync badge labels, chip
  labels on record cards, the install guide, `aria-label`s and `title`s.
- Form field labels (`FieldDef.label`), placeholders, and validation
  messages (`patternMessage`, the "is required" message).
- Field group headings (`FieldGroup`).
- Backend error messages by code. `ApiErrorCode` gets a translation key per
  code (`errors.BAD_PIN`, `errors.BUSY`, ...). A helper
  `apiErrorMessage(err: unknown, t): string` in `src/i18n/errors.ts` is the
  only place that turns a caught error into display text: for an `ApiError`
  with a known code it returns `t('errors.' + code)`, except `INTERNAL` and
  `VALIDATION` whose server text carries specifics and is returned as-is; for
  a `NetworkError` it returns `t('errors.NETWORK')`; for anything else it
  returns `t('errors.UNKNOWN')`. Every `err.message` shown in the UI today
  goes through this helper.
- Queue item `message` (stored English text from a past failure) is shown
  as-is; it is a diagnostic string and is not re-translated.

Not translated (identifiers or shared-channel content): sheet names,
location codes, column headers, the WhatsApp text, and the app name.

### Config refactor

`FieldDef.label`, `placeholder`, `patternMessage` and `FieldGroup` become
translation keys rather than English strings. `config.ts` stays the single
source of truth for headers and validation; a helper `fieldLabel(f, t)`
resolves the label. `buildWhatsAppText` needs English labels regardless of
UI language, so it resolves keys with a fixed English `t` obtained via
`i18n.getFixedT('en')`.

### Language switcher

- New component `src/components/LanguageMenu.tsx`: an `IconButton` with a
  globe icon (`@mui/icons-material/Language`), `aria-label` translated,
  opening a MUI `Menu` with three `MenuItem`s labelled in their own script:
  `English`, `తెలుగు`, `हिन्दी`. The current language is marked with a check
  icon and `aria-current`.
- Rendered inside `Screen.tsx`'s actions slot on every screen, after the
  screen-specific `actions` (so it sits at the far right, next to the sync
  badge when present). `Screen` gains no new props; the switcher is always
  present.
- The menu closes on hardware back via the existing `useBackClose` hook, like
  the other overlays.

### Layout check

Telugu and Hindi strings run longer than English. Required checks at 360px
width: app bar title/subtitle with two action buttons, the two `Tabs`
labels, the two bottom buttons on `EntryForm`, and the `SyncBadge` chip.
Where a string does not fit, shorten the translation rather than restyle.

---

## 3. Theme: Chakra Teal on MUI

### Palette (Chakra default tokens)

| Role | Token | Hex |
|---|---|---|
| primary.main (app bar, primary buttons) | teal.600 | `#2C7A7B` |
| primary.light | teal.500 | `#319795` |
| primary.dark | teal.700 | `#285E61` |
| secondary.main | teal.400 | `#38B2AC` |
| success.main / dark | green.500 / green.600 | `#38A169` / `#2F855A` |
| warning.main | orange.500 | `#DD6B20` |
| error.main | red.500 | `#E53E3E` |
| background.default | gray.50 | `#F7FAFC` |
| background.paper | white | `#FFFFFF` |
| text.primary | gray.800 | `#1A202C` |
| text.secondary | gray.600 | `#4A5568` |
| divider | gray.200 | `#E2E8F0` |

Shape: `borderRadius: 6` (Chakra `md`). Shadows: cards use Chakra `sm`
(`0 1px 2px 0 rgba(0,0,0,0.05)`), the form footer uses Chakra `md`
(`0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)`).
Record-card accent for queued entries uses `warning.main`, for errors
`error.main`, unchanged in role.

### Single source of truth

- `theme.ts` is the only place colours are defined. It is created with
  `createTheme({ cssVariables: true, ... })` so MUI 7 emits `--mui-palette-*`
  variables on `:root`.
- `global.css` drops its `--scr-*` variable block and references
  `var(--mui-palette-primary-main)` and friends. The toast, install-steps and
  detail-grid rules are updated accordingly.
- Inline whites in `Screen.tsx`, `SheetScreen.tsx` tabs and `SyncBadge.tsx`
  keep their `rgba(255,255,255,…)` values (they are contrast overlays on the
  primary bar, not brand colours). The `SyncBadge` dot colours move to
  `warning.light` / `error.light` from the theme.
- `index.html` `<meta name="theme-color">` and the manifest `theme_color`
  become `#2C7A7B`; manifest `background_color` becomes `#F7FAFC`.

### Icons

`public/favicon.svg` background changes to `#2C7A7B`. The four PNGs in
`public/icons/` are re-rendered from the SVG by a new one-off script
`scripts/render-icons.mjs` using `sharp` (devDependency), at 192, 512,
512-maskable (with safe-zone padding) and 180 (apple-touch-icon).

---

## 4. Typography

- Add Inter woff2 files (weights 400, 600, 700, latin subset) to
  `src/fonts/` with `@font-face` declarations in `global.css` using
  `font-display: swap`. Files are imported by the CSS so Vite hashes them and
  the service worker `globPatterns` gains `woff2` so they are precached.
- Font stack, in this order:

  ```
  -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto,
  "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans", system-ui, sans-serif
  ```

  Apple devices resolve `-apple-system` first and render San Francisco.
  Everything else renders Inter for Latin text. Telugu and Devanagari glyphs
  are absent from Inter and fall through to the device's script fonts
  (Kohinoor/Telugu Sangam on iOS, Noto on Android).
- `SYSTEM_FONT` in `theme.ts` is renamed `APP_FONT` and remains the single
  definition used by MUI typography and by `global.css` via
  `var(--mui-font-family)` (MUI emits it under `cssVariables`).
- Line height for Telugu and Devanagari needs slightly more room: the body
  `line-height` is raised to 1.5 (from MUI's 1.43 for body1). Checked
  visually in step 2's layout pass.

---

## 5. Error handling

- Analytics: every call is wrapped; failures are silently dropped. No retries,
  no queueing of events while offline (Vercel's script handles what it can).
- i18n: `fallbackLng: 'en'` covers a missing translation at runtime, but the
  type augmentation makes that a build error first. If localStorage is
  unavailable, the language is still switchable for the session and simply
  does not persist.
- Theme: no runtime failure modes; the build's `tsc` step catches a wrong
  token name.

---

## 6. Testing

Automated (vitest, jsdom for the React pieces):

- `analytics.test.ts`: `trackEvent` is a no-op when not production; it never
  throws when the underlying `track` throws; `client_error` payload contains
  only name, message and source.
- `i18n.test.ts`: detection order (stored > navigator te/hi > en); invalid
  stored values fall back; `changeLanguage` writes storage and
  `document.documentElement.lang`; `_one`/`_other` plurals resolve in all
  three languages; `errors.<code>` exists for every member of `ApiErrorCode`,
  including the client-side `BAD_RESPONSE`.
- `locales.test.ts`: every key path in `en` exists in `te` and `hi` and vice
  versa (belt-and-braces alongside the type check), and no value is an empty
  string.
- `whatsapp.test.ts` (existing): still produces English labels when the UI
  language is Telugu.
- `LanguageMenu.test.tsx`: renders three options, marks the current one,
  calls `changeLanguage` and emits `language_changed`.

Manual, before each step is called done:

- Phone width (360px) walkthrough in all three languages: home, direction,
  sheet with both tabs, edit, delete dialog, install guide.
- Offline reload: fonts and translations render with the network disabled.
- Production build served locally: Vercel script is requested from
  `/_vercel/insights/script.js` and is not precached by the SW.
- Lighthouse performance score on the built app not lower than before Inter
  was added (baseline recorded first).

---

## 7. Delivery order

Each step is one PR-sized change that leaves `main` shippable.

1. **Analytics** — `analytics.ts`, event calls, SW rule, README note.
2. **Theme + font + icons** — `theme.ts`, `global.css`, manifest/meta, Inter
   files, `render-icons.mjs`, regenerated PNGs.
3. **i18n runtime + English + switcher** — i18next setup, type augmentation,
   `en.ts`, all components moved to `t()`, `LanguageMenu`, config refactor,
   error-code mapping. App still reads entirely in English.
4. **Telugu and Hindi dictionaries** — `te.ts`, `hi.ts`, completeness tests,
   the 360px layout pass, shortening translations where needed.

## 8. Files touched (expected)

New: `src/analytics.ts`, `src/i18n/index.ts`, `src/i18n/errors.ts`, `src/i18n/i18next.d.ts`,
`src/i18n/locales/{en,te,hi}.ts`, `src/components/LanguageMenu.tsx`,
`src/fonts/*.woff2`, `scripts/render-icons.mjs`, tests listed above.

Modified: `src/main.tsx`, `src/App.tsx`, `src/theme.ts`,
`src/styles/global.css`, `src/config.ts`, `src/utils/whatsapp.ts`,
every file under `src/screens/` and `src/components/`,
`vite.config.ts`, `index.html`, `public/favicon.svg`, `public/icons/*`,
`package.json`, `README.md`.
