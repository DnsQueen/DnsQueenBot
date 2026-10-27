# DNSQUEEN

**Serverless Telegram Mini App that turns messy resolver/IP dumps into a clean, one-address-per-line list.**

Paste (or drop) any mix of `IP:port` pairs, bracketed IPv6, URLs, CIDR blocks, logs and junk text — DNSQUEEN extracts every valid address, removes duplicates and private ranges, sorts numerically, and gives you **Copy-all** plus a ready `.txt` download.

---

## Features

- **IPv4** with ports (`8.8.8.8:53`, `1.1.1.1#53`) — port stripped, IP kept
- **IPv6** with brackets and port (`[2001:db8::1]:853`) — normalized to RFC 5952
- **Duplicate detection across representations** — `8.8.8.8:53`, `008.008.008.008` and `2001:0db8:…:0001` vs `2001:db8::1` collapse to one entry
- **Original order preserved** by default; optional **true numeric sort** (IPv4 as 32-bit, IPv6 as bigint — never lexicographic) and reverse sort
- **Private/loopback/link-local/ULA/multicast filtering** (IPv4 + IPv6), toggleable, with a live counter
- **Mixed text & URLs** — `https://dns.google/resolve?name=x`, `v1.2.3.4`, `2024.10.27` are skipped, not guessed
- **Ambiguity rejection** — `999.1.1.1`, `1.2.3.4.5` are dropped instead of “best-effort” parsed
- **CIDR modes**: strip mask (`203.0.113.0/24` → `203.0.113.0`), keep as-is, or drop whole row
- **Live settings** — every toggle re-renders instantly, no re-paste needed
- **Output formats**: one per line / comma separated / spaces / JSON
- **Copy-all** with layered fallback (async Clipboard → `ClipboardItem` → `execCommand`) and a visible ✓ feedback; clear error when the browser blocks it
- **`.txt` download** with UTF-8 BOM (opens correctly in Windows Notepad), plus a JSON export
- **File drop** — `.txt`/`.csv` up to **2 MB** with an explicit error above the cap; empty file and empty input show guidance, never a crash
- **Mobile-first responsive UI** (breakpoints at 900 px / 620 px), full RTL-safe typography, respects `prefers-reduced-motion`
- **Stats strip**: total found, duplicates removed, private removed, v4/v6 split, parse time in ms
- Render cap of **400 rows** on screen for huge lists (Copy/Download still deliver everything)

## Architecture & why these technologies

| Choice | Reason |
|---|---|
| **Vite + React 19 + TypeScript** | Static bundle, instant HMR, strict typing on the parsing engine |
| **100 % client-side, no backend** | The whole product is text processing — a serverless *static* deploy (Cloudflare Pages) is the cheapest, fastest and most robust hosting; no VPS, no cold starts, no secrets |
| **Pure-function engine** (`src/engine/ip-parser.ts`) | Parsing, validation, dedupe, sorting and formatting are deterministic and fully unit-tested; the UI only renders |
| **Zustand-free custom hook** (`useParser.ts`) | One memoized parse pass, settings persisted in `localStorage` (`dnsqueen.settings`), presentation changes (port keep/drop) applied without re-running the engine |
| **Self-hosted fonts** (`@fontsource-variable`) | No CDN dependency inside Telegram’s WebView; Fraunces (display serif) vs IBM Plex Mono vs Archivo — deliberate contrast instead of the usual “AI dashboard” look |
| **Dark graphite palette + phosphor accent** | Custom design system in `index.css` (CSS custom properties), hairline borders and typographic hierarchy — no generic card shadows |

## Project structure

```
dnsqueen/
├── index.html                 # entry, fonts preloaded
├── vite.config.ts             # React plugin + vitest config
├── src/
│   ├── main.tsx               # mount
│   ├── App.tsx                # dashboard: header, stats strip, input/output panes, controls
│   ├── App.css                # component styles (design system application)
│   ├── index.css              # tokens, base, fonts, scrollbars, motion prefs
│   ├── engine/
│   │   ├── ip-parser.ts       # THE engine: extract → validate → dedupe → filter → sort → format
│   │   └── ip-parser.test.ts  # 26 unit tests
│   ├── hooks/useParser.ts     # memoized parse + persisted settings + toast state
│   ├── lib/clipboard.ts       # copy fallback chain + .txt/.json download (BOM-safe)
│   └── App.test.tsx           # 4 UI tests (jsdom + Testing Library)
└── dist/                      # build output (deployable as-is)
```

## Commands

```bash
npm install        # install deps
npm run dev        # local dev server (Vite)
npm test           # vitest: 66 tests (engine + regressions + UI/i18n)
npm run lint       # oxlint
npm run build      # tsc -b && vite build  → dist/
npm run preview    # serve the production build locally
```

### Verified results (last run, 2026-10-28)

```
npx tsc -b          PASS  exit 0, 0 errors
npx vitest run      PASS  3 files / 66 tests
npx oxlint          PASS  0 warnings, 0 errors (13 files, 116 rules)
npm run build       PASS  ✓ built — JS 251.44 kB (gzip 79.61 kB),
                           CSS 18.64 kB (gzip 4.86 kB)
```
The source in this ZIP was also re-tested from a clean extraction (`npm ci` →
`tsc -b` → `vitest` → `build`) and builds from scratch.

## Deploy to Cloudflare Pages (serverless, free)

**Option A — Git integration**
1. Push this repo to GitHub/GitLab.
2. Cloudflare Dashboard → *Workers & Pages* → *Create* → *Pages* → *Connect to Git*.
3. Build settings: framework **Vite**, build command `npm run build`, output directory `dist`.
4. Deploy — you get `https://dnsqueen.pages.dev` (HTTPS, required for Mini Apps).

**Option B — Direct upload (no Git)**
```bash
npm install -g wrangler
npx wrangler pages deploy dist --project-name dnsqueen
```

**Option C — Upload the ready-made `dnsqueen-pages-upload.zip` (no CLI, no Git account)**

This ZIP is the production build only: `index.html` sits at its **root**, next to `assets/`, `favicon.svg` and `icons.svg`. That is exactly the shape Cloudflare Pages expects for a direct upload — do **not** unzip it into a `dist/` folder first.

1. Sign in at <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** → **Upload assets** (the "direct upload" tab).
2. Project name: `dnsqueen` → **Create project**.
3. Drag the **`dnsqueen-pages-upload.zip` file itself** onto the upload area (drag the `.zip`, not the unpacked folder), or use **Select from computer** and pick the `.zip`.
4. **Deploy site**. Cloudflare unpacks it and serves `index.html` from the root. You get `https://dnsqueen.pages.dev` (or `https://<project>.pages.dev`) over HTTPS — HTTPS is required for the Clipboard API and for Mini Apps.
5. Open the URL in a browser once to confirm it loads, then go to the next section to attach it to your bot.

To publish a later version, repeat steps 1–4 in the same project (**Create deployment → Upload assets**) — the URL stays the same.

> Vercel/Netlify work the same way: build `npm run build`, publish `dist`. For Netlify's manual drag-and-drop, unzip `dnsqueen-pages-upload.zip` and drop the folder.

## Attach to your existing Telegram bot (BotFather)

1. Open **@BotFather** → `/mybots` → pick your bot.
2. **Bot Settings → Configure Mini App** (or `/newapp` for a fresh one):
   - *Mini App name*: e.g. `DNSQUEEN`
   - *URL*: your `https://…pages.dev` address
   - *Short name*: `dnsqueen`
3. Users open it via a `web_app` button:
   - **Menu button** (Bot Settings → Configure app menu) — makes the Mini App the bot’s main button, or
   - a reply/inline keyboard button:
     ```json
     {"text":"🧬 Clean my list","web_app":{"url":"https://dnsqueen.pages.dev"}}
     ```
4. No webhook or backend changes are needed — the Mini App is pure frontend; your existing bot keeps running untouched.

**Manual steps for you (need your own accounts):**

1. Create/sign in to a Cloudflare account and upload `dnsqueen-pages-upload.zip` (Deploy → Option C) — or run `npx wrangler pages deploy dist --project-name dnsqueen`.
2. Copy the resulting `https://…pages.dev` URL.
3. In BotFather, set that URL as the Mini App / Menu button URL for your existing bot (steps above).

Nothing was deployed and no bot setting was changed by this build. No bot token is needed for the Mini App itself: it is a static page, and Telegram passes user data at runtime via `initData`.

## Limits & known gaps

- **No server-side persistence** — history/settings live in the browser’s `localStorage` (per device/browser). A cloud history would need a backend (D1/KV) — future work.
- **No DNS resolution** — domains in the input are ignored (extraction only; no lookup).
- Input capped at **2 MB** per file; on-screen rendering capped at 400 rows (copy/download are full).
- Clipboard API needs a secure context (HTTPS or localhost) — fallbacks cover older browsers, but a denied permission shows an explicit error toast.
- IPv4-mapped IPv6 (`::ffff:1.2.3.4`) is kept as IPv6, not converted.
- Automated screenshots of the UI could not be produced in the build sandbox (no usable browser); UI behavior is covered by 4 jsdom tests instead — see *Verified results*.

## License

MIT — do whatever, at your own risk.


## v1.1 — bilingual UI, light/dark theme, final engine fixes

### UI i18n (Persian / English)
- `src/i18n/translations.ts` holds two complete, structurally identical dictionaries (`fa`, `en`). Every visible string, aria-label, tooltip, toast, error and empty-state text goes through `t('key')`; no hardcoded UI strings remain in components.
- `src/hooks/usePreferences.ts` owns the two independent preferences (`dnsqueen.language`, `dnsqueen.theme`), each persisted separately, with in-memory fallback if `localStorage` throws. Switching language never touches theme and vice versa.
- Language switch sets `<html lang>` and `<html dir>` (`fa` → `rtl`, `en` → `ltr`) instantly, without a reload. IP addresses, ports, CIDR and the TXT payload are rendered/copied from engine data only, never translated; technical values are forced `dir="ltr"`.
- Header has two adjacent controls: `#lang-toggle` (language) and `#theme-toggle` (theme).

### Light / dark theme
- Dark Bat Purple stays the brand default (`data-theme="dark"`); light is a full, contrast-checked companion palette (`#F7F5FB`, `#FFFFFF`, `#F0ECF7`, `#DDD4EA`, text `#21172F` / `#64576F`).
- All colours come from CSS custom properties on `:root[data-theme=...]`; no component-level colour literals. Mint green no longer exists anywhere.
- Telegram header/background colours follow the chosen theme, but a manual choice is never overwritten by environment theme-change events.

### Engine (regressions covered by `src/engine/regression.test.ts`)
| Case | Expected |
|---|---|
| `::ffff:192.168.1.1`, `::ffff:8.8.8.8`, `[::ffff:192.168.1.1]:443` | one valid address each, never split into `::ffff:192` + a bare IPv4 |
| `8.8.8.8/99`, `2001:db8::1/129` | rejected and counted as invalid CIDR, never silently stripped (IPv4 0–32, IPv6 0–128) |
| CIDR Keep / Strip / Drop block | three documented behaviours, each with tests |
| ordering + dedupe | results ordered by real first occurrence, dedupe after ordering; host+port is the identity key only when "Keep port" is on |
| classification | `private / loopback / linklocal / documentation / multicast / reserved / public`; `203.0.113.14` is *documentation*, not private |
| Hide private / Hide special-use | two separate switches; "Hide private" removes only local ranges |

### Telegram Mini App SDK
`src/lib/telegram.ts` is initialised once from `src/main.tsx`: `ready()`, `expand()`, header/bg colours, `disableVerticalSwipes` and haptics are all feature-detected, `viewportChanged` feeds `--tg-vh`. Works unchanged as a plain web page (no bot token anywhere in the frontend).

### Verification (real output, this build)
```text
npx tsc -b        -> exit 0
npx oxlint        -> Found 0 warnings and 0 errors (14 files, 116 rules)
npx vitest run    -> Test Files 3 passed (3) | Tests 66 passed (66)
npm run build     -> ✓ built in 215ms | JS 251.44 kB (gzip 79.61 kB), CSS 18.64 kB (gzip 4.86 kB)
```

### Deploy (static, serverless)
```bash
npm ci && npm run build      # -> dist/
npx wrangler pages deploy dist --project-name dnsqueen
```
No Docker, no backend, no database, no VPS. Then attach the resulting URL to the **existing** bot via BotFather (`/mybots` → Bot Settings → Configure Mini App / Menu Button). Nothing is published by this repository itself.
