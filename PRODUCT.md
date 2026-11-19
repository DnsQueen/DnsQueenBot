# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

General public — anyone with messy text containing IP addresses (pasted text or `.txt` files), needing a clean list fast. No specialist knowledge is assumed; the tool must work for a first-timer as well as for someone who handles IP lists daily. Persian-speaking users first, English available.

## Product Purpose

DNSQUEEN extracts IPv4 and IPv6 addresses from supplied text, removes duplicates, and produces a clean list the user can copy or save. It exists so a messy paste — logs, configs, resolver lists — becomes a usable list in seconds, with no account, no upload, and no waiting. Success means: paste → clean list → copied or downloaded, with the user trusting every line of the result.

## Positioning

Fully local extraction: the web app processes everything in the visitor's browser — no upload, no server, no database, no tracking of the pasted content. One extraction engine serves two entry points (web app and optional Telegram bot). Persian-first by construction, not by translation layer.

## Operating Context

- Web app (Vite + React), deployed on Cloudflare Pages; also opened as a Telegram Mini App.
- Optional Telegram bot (Cloudflare Pages Function) accepting text and `.txt` documents, using the same engine.
- Inputs: pasted text, `.txt`/`.csv`/`.list` files up to 2 MB; resolver lists, logs, configs, URLs with embedded addresses, ports, CIDR notation.
- Outputs: clean list as newline-, comma-, or space-separated text, or JSON; copy to clipboard or download as `.txt`/`.json`.

## Capabilities and Constraints

- Extracts IPv4 and IPv6, including addresses with ports and CIDR masks; removes duplicates; filters private and special-use addresses per user settings; preserves input order or sorts numerically/reversed.
- Copy individual addresses or the complete result; export as TXT or JSON.
- Persian and English interface, RTL layout for Persian, dark and light themes, responsive mobile and desktop.
- Extraction only: DNSQUEEN is not a DNS resolver, proxy, VPN, IP scanner, or connectivity tester. It does not test whether an address is online, reachable, or safe.
- Web extraction needs no application server or database; the Telegram bot needs a Cloudflare deployment with two server-side secrets.

## Brand Commitments

- Name DNSQUEEN stays. The crown mark (the bat/crown SVG in the header) stays as the brand asset.
- The visual world is otherwise free in this redesign: the violet identity, palette, typography, and layout are not pinned and may be replaced.

## Evidence on Hand

- README.md (features, deployment, privacy) and the live implementation in `src/App.tsx`, `src/App.css`, `src/index.css`.
- Sample data in the app covers resolver lists, ports, CIDR, and deliberate invalid cases.
- No testimonials, customers, benchmarks, or pricing exist; none may be invented.

## Product Principles

1. Local first: the user's text never leaves their device in the web app.
2. Instant and honest: parse live, show the count and the time, and show what was removed — never silently drop rows.
3. For everyone: a first-timer gets a clean list without learning anything; no jargon without an explanation.
4. The list out is the product: copy and download are the peak moments, not an afterthought.
5. Persian-first: Persian is the reference language; nothing ships in English only.
