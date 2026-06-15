# Third-Party Notices

Attribution for third-party code **adapted** into this repository's source
tree. Unmodified npm dependencies are covered by their own licenses under
`node_modules/` and are not listed here.

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
