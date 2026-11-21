# Contributing to Micelclaw Dash

Core and Dash contributions are open. Build the linked mail UI first, then run `corepack pnpm@9.15.4 build` and `corepack pnpm@9.15.4 lint` from Dash. See README.md for the three-repository layout.

For a UI change, include a small wireframe of the affected states/actions, preserve the typed Core contract and provide a meaningful regression or precise manual reproduction. Check keyboard and the mobile viewport relevant to the advertised surface. Preserve origins, ownership, ACLs, persistence and error visibility. Do not guess backend fields or add undocumented API fallbacks.

For changes crossing Core, follow the full [Core contribution guide](https://github.com/micelclaw/micelclaw-os/blob/main/CONTRIBUTING.md). Changes to Core belong in that repository and must identify the compatible Dash revision. Do not include unrelated generated files or installation changes in a UI fix.

The e2e/contract scripts expect a separate maintainer workspace; it is not an available public test suite merely because those scripts exist. Describe exactly which checks you executed, including synthetic fixture conditions and skipped prerequisites. No automated CI, CLA bot, response SLA or badge system is promised.

You retain copyright. For original first-party code or documentation, include the manual acceptance statement in [CONTRIBUTOR_AGREEMENT.md](CONTRIBUTOR_AGREEMENT.md); a maintainer records it before merge. Third-party adaptations keep their licenses, and you must identify their source. Do not claim third-party code as your own or replace its notices with a BSL header.

Use the bug template without personal data, unredacted logs or credentials. Report security-sensitive issues using [SECURITY.md](SECURITY.md).
