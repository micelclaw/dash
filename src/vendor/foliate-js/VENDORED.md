# Vendored: foliate-js

- Upstream: <https://github.com/johnfactotum/foliate-js>
- Commit: `78914aef4466eb960965702401634c2cb348e9b1` (HEAD of `main`,
  2026-05-01, "Use original hrefs for external links and add isExternal
  in fb2.js (#129)")
- Vendored on: 2026-06-12
- License: MIT (full text in `LICENSE` in this directory and below)

## Files kept (EPUB reader subset)

Only the modules needed to render EPUBs are vendored:

| File | Why |
|---|---|
| `view.js` | `<foliate-view>` custom element — open/goTo/relocate/annotations (MODIFIED, see below) |
| `paginator.js` | `<foliate-paginator>` reflowable renderer (pagination, swipe, columns) |
| `fixed-layout.js` | `<foliate-fxl>` renderer for pre-paginated (fixed-layout) EPUBs |
| `epub.js` | EPUB parser (`EPUB` class) |
| `epubcfi.js` | CFI parse/serialize utilities (imported by `view.js`/`epub.js`) |
| `progress.js` | `SectionProgress`/`TOCProgress` (fraction + TOC item per location) |
| `overlayer.js` | SVG overlay used to draw highlights/annotations |
| `search.js` | `searchMatcher` (lazily imported by `view.js#search`) |
| `text-walker.js` | text-range walker (dep of `view.js`/`search.js`/`tts.js`) |
| `tts.js` | lazily imported by `view.js#initTTS` (kept so the import resolves) |
| `LICENSE` | upstream MIT license text |

NOT vendored (and stripped from `view.js`, see below): `comic-book.js`,
`fb2.js`, `mobi.js`, `pdf.js` (would pull `pdfjs-dist`), `dict.js`,
`opds.js`, `footnotes.js`, `quote-image.js`, `uri-template.js`,
`reader.{html,js}`, `ui/*`, `vendor/*` (their rollup-bundled zip.js/fflate),
`rollup/*`, tests.

## Local modifications (all marked with `[Micelclaw]` comments)

`view.js` only:

1. `makeZipLoader`: `import('./vendor/zip.js')` → `import('@zip.js/zip.js')`
   (the npm package `@zip.js/zip.js`, BSD-3-Clause, instead of upstream's
   rollup-bundled copy).
2. `makeBook`: EPUB-only — the CBZ/FBZ branch throws
   `UnsupportedTypeError`, and the PDF/MOBI/bare-FB2 branches were removed
   so Vite never tries to resolve the non-vendored modules.

Everything else is byte-identical to upstream at the commit above.

## TypeScript

This directory is excluded from typecheck (`tsconfig.app.json` →
`exclude: ["src/vendor"]`). The bits the dash uses are declared in
`src/modules/books/reader/foliate.d.ts`.

## Upstream license (MIT)

```
MIT License

Copyright (c) 2022 John Factotum

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
