# Micelclaw Dash

Frontend for [Micelclaw OS](https://micelclaw.com).

Licensed under BSL 1.1 — see LICENSE.

> **Note on licensing.** `LICENSE` is the Business Source License 1.1, with an *Additional Use
> Grant* allowing **personal, non-commercial** use by individuals, and a Change Date of
> **March 1, 2030**, after which it converts to Apache-2.0. The header stamped into the source
> files (`LICENSE-HEADER.txt` — present in 1,340 of the 1,370 `.ts`/`.tsx` files under `src/`)
> says the opposite: "All rights reserved… Unauthorized copying,
> modification, distribution, or use of this file, via any medium, is strictly prohibited."
>
> ⚠️ **Requiere validación humana:** which one governs? If `LICENSE` does, `LICENSE-HEADER.txt`
> should be aligned with the BSL (naming the Additional Use Grant and the Change Date). If the
> restrictive header is deliberate, this README should explain how the two texts relate — otherwise
> anyone opening a `.tsx` concludes that no use at all is permitted.

## Prerequisite: the `micel-mail` sibling repo

`dash` consumes `@micelclaw/mail-admin-ui` as a **linked** dependency
(`"@micelclaw/mail-admin-ui": "link:../micel-mail/admin-ui"` in `package.json`). Two consequences
on a clean clone of this repo alone — and they break at **different** moments:

1. The sibling repo `micel-mail` must be cloned **next to this one**, at `../micel-mail`, or
   `pnpm install` itself fails: a `link:` dependency is a symlink to that path.
2. Its `admin-ui` package points `main` at `dist/index.js`, and that `dist/` is **not versioned**
   (`admin-ui/.gitignore`). It has no `prepare`/`postinstall` script, so `pnpm install` still
   succeeds — what fails later is `pnpm dev` / `pnpm build`, when Vite/tsc resolve the import.

```bash
pnpm -C ../micel-mail/admin-ui install
pnpm -C ../micel-mail/admin-ui build
```

## Development

```bash
pnpm install
pnpm dev
```

`pnpm dev` serves Vite on **http://localhost:7100** and proxies `/api` and `/ws` to Micelclaw Core
on `127.0.0.1:7200` (Core must be running). Other scripts:

- `pnpm build` — `tsc -b` + `vite build`
- `pnpm lint` — ESLint 10 (flat config)
- `pnpm e2e` / `pnpm contracts` — the suite lives outside this repo, in `../tests/dash`

### Maintenance scripts

- `node scripts/fetch-brand-icons.mjs` — re-vendors the 24 provider logos under
  `src/assets/brand-icons/` (one-time download; **no CDN at runtime**, for CSP and offline-first
  reasons). Run it from the `dash/` root when adding a new provider. These are third-party
  trademarks, not npm dependencies: per-file provenance and use justification live in
  [`src/assets/brand-icons/ATTRIBUTION.md`](src/assets/brand-icons/ATTRIBUTION.md), and
  [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) carries a summary entry pointing there, so a
  licensing audit that starts from that file does not miss them.
