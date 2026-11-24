# Micelclaw Dash

Frontend for [Micelclaw OS](https://micelclaw.com).

Licensed under BSL 1.1 — see LICENSE.

> **Note on licensing.** [`LICENSE`](LICENSE) contains the Business Source License 1.1,
> its Additional Use Grant and conversion terms, including the earlier four-year conversion
> where applicable. [`LICENSING.md`](LICENSING.md) explains the stated scope, the relationship
> with legacy restrictive headers still present in some first-party files, and separately licensed
> materials. `LICENSE-HEADER.txt` is the BSL replacement template; do not apply it to third-party
> code. These documents do not substitute for a review of a particular distribution.

## Prerequisite: the `micel-mail` sibling repo

The maintainer workspace may also contain the independent `micelclaw-os` repository and a separate `tests` directory;
the sibling mail dependency below is required for the Dash build. The cross-repository test scripts
refer to `../tests/dash` and require their own workspace and prerequisites.

`dash` consumes `@micelclaw/mail-admin-ui` as a **linked** dependency
(`"@micelclaw/mail-admin-ui": "link:../micel-mail/admin-ui"` in `package.json`). The sibling
is [micel-mail](https://github.com/micelclaw/micel-mail); obtain it alongside Dash before
installing dependencies. Two consequences for a clean clone of Dash alone:

1. The sibling repo `micel-mail` must be present **next to this one**, at `../micel-mail`:
   the `link:` dependency points to that path. The exact install failure without it was not tested.
2. Its `admin-ui` package points `main` at `dist/index.js`, and that `dist/` is **not versioned**
   (`admin-ui/.gitignore`). It has no `prepare`/`postinstall` script; build it before Dash so
   Vite/tsc can resolve its output.

Check Node compatibility for both lockfiles and installed dependencies. The sibling build below
removes and regenerates its `admin-ui/dist/`; preserve any local work there first.

```bash
pnpm -C ../micel-mail/admin-ui install
pnpm -C ../micel-mail/admin-ui build
```

## Documentation

- [Agent security interface](docs/agents/security.md): interaction, evidence and limits; the corresponding Core security contract is linked there.

## Development

```bash
pnpm install
pnpm dev
```

`pnpm dev` attempts to serve Vite on port **7100** and proxies `/api` and `/ws` to Micelclaw Core
on `127.0.0.1:7200` (Core must be running). Vite uses HTTPS when configured certificates are
available and HTTP otherwise; check the address printed by the server. Vite listens on network
interfaces (`host: true`), so check network access before starting it. Other scripts:

- `pnpm build` — `tsc -b` + `vite build`
- `pnpm lint` — ESLint 10 (flat config)
- `pnpm e2e` / `pnpm contracts` — the suite lives outside this repo, in `../tests/dash`. Check each spec and its target before running: the default mock configuration does not guarantee every spec is isolated, and a spec may address port 7100 or a configured instance. For product tests use Paco Trueno (`dd4d75fb`), never an administrator account.

### Maintenance scripts

- `node scripts/fetch-brand-icons.mjs` — re-vendors the 24 provider logos under
  `src/assets/brand-icons/` (one-time download; **no CDN at runtime**, for CSP and offline-first
  reasons). It fetches external URLs and overwrites assets progressively; a failed download can
  leave a partial update. External access requires the applicable approval before running it; run it from the `dash/` root when adding a new provider. These are third-party
  trademarks, not npm dependencies: per-file provenance and use justification live in
  [`src/assets/brand-icons/ATTRIBUTION.md`](src/assets/brand-icons/ATTRIBUTION.md), and
  [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) carries a summary entry pointing there, so a
  licensing audit that starts from that file does not miss them.
