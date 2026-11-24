# Third-Party Notices

Attribution for selected third-party code adapted or used in this repository,
including a regular npm dependency listed below. This is not a complete inventory
of npm dependencies or a particular distribution: their own licenses apply, and
`node_modules/` exists only after dependencies are installed.

## foliate-js — MIT

- Project: <https://github.com/johnfactotum/foliate-js>
- License: MIT (full text in `src/vendor/foliate-js/LICENSE`)
- Vendored into: `src/vendor/foliate-js/` (EPUB-only subset of upstream
  commit `78914aef4466eb960965702401634c2cb348e9b1`, 2026-05-01)
- What: the `<foliate-view>` e-book renderer (view/paginator/fixed-layout/
  epub/epubcfi/overlayer/progress/search/text-walker/tts modules) used by
  the books module reader (`src/modules/books/reader/`). Local
  modifications are listed in `src/vendor/foliate-js/VENDORED.md`.

## zip.js (@zip.js/zip.js) — BSD-3-Clause

- Project: <https://github.com/gildas-lormeau/zip.js>
- License: BSD-3-Clause (see `node_modules/@zip.js/zip.js/LICENSE`)
- Used as: regular npm dependency, loaded by the vendored
  `src/vendor/foliate-js/view.js` (its `makeZipLoader` was repointed from
  upstream's bundled copy to this package) to unpack EPUB containers.

## react-reader — Apache-2.0

- Project: <https://github.com/gerhardsletten/react-reader>
- License: Apache License 2.0
- Adapted into: `src/modules/books/reader/` (concepts only)
- What: reader UX ergonomics (click zones for paging, settings persisted to
  localStorage, TOC drawer interaction model) informed the React reader
  components. No source code was copied.

## Streamyfin — MPL-2.0

- Project: <https://github.com/streamyfin/streamyfin>
- License: Mozilla Public License 2.0 (<https://mozilla.org/MPL/2.0/>)
- Adapted into: `src/modules/video/lib/stream-resolver.ts`
- What: the playback resolution flow (device profile → Jellyfin
  PlaybackInfo → direct-play vs HLS-transcode decision) is adapted from
  concepts in Streamyfin's `getStreamUrl.ts`. The file is kept isolated so
  the adapted logic stays contained; per MPL-2.0, the adapted portions
  remain available under MPL-2.0.

## Brand logos (third-party trademarks) — no license granted

- Vendored into: `src/assets/brand-icons/` — **24 image files**
  (`ls src/assets/brand-icons/ | grep -vi '\.md$' | wc -l`), downloaded once by
  `scripts/fetch-brand-icons.mjs` and committed. Nothing is fetched from a CDN
  at runtime (CSP / offline-first).
- Sources: <https://github.com/homarr-labs/dashboard-icons> (20 files),
  <https://github.com/selfhst/icons> (1 file) and the providers' own public
  app-icon/favicon assets (3 files: AOL, Posteo, WEB.DE).
- License: **none**. Neither upstream catalogue relicenses the logos — each one
  remains the registered trademark of its owner (14 brands: Google, Microsoft,
  Proton, iCloud, Synology, Nextcloud, Fastmail, Yahoo, Yandex, Zoho,
  mailbox.org, AOL, Posteo, WEB.DE). They are used for **nominative
  identification** of the provider a user connects on the integrations screen,
  not promotionally: Micelclaw is not affiliated with, sponsored by, or
  endorsed by any of them.
- Why they are listed here even though they are neither code nor npm
  dependencies: a license audit that starts from this file would otherwise miss
  them entirely.
- Per-file provenance, source URL and use justification:
  `src/assets/brand-icons/ATTRIBUTION.md` (it also documents the four logos that
  are *not* vendored and are painted from the CC0 `simple-icons` package
  instead). The regeneration script `scripts/fetch-brand-icons.mjs` downloads
  external assets and writes the vendored files; review provenance, changes and
  authorization before running it. This notice does not establish redistribution
  rights for a particular release.

## Source alpha licensing boundary

The first-party BSL grant does not replace these licenses. This distribution licenses the entire `src/modules/video/lib/stream-resolver.ts` file under MPL-2.0, preserving its adaptation notice. npm dependencies and compiled distributions require notices for their actual versions; do not ship node_modules or private runtime material. See LICENSING.md.
