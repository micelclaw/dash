# Licensing scope

## First-party Core and Dash

The accompanying `LICENSE` applies to the first-party source and documentation in this distribution, except the separately licensed materials below. It is Business Source License 1.1 with the Additional Use Grant and Change Date written in that file. It is source-available, not an OSI open-source license.

The license permits non-production copying, modification, derivative works and redistribution. That permission is available to individuals and organizations; a blanket “no forks” or “no commercial redistribution” restriction is not part of this BSL text. The Additional Use Grant permits personal, private non-commercial production use by a natural person not acting for a legal entity. Production use outside that grant requires a separate commercial license. Runtime feature tiers do not change the source license's terms, and buying a tier does not by itself grant an unspecified redistribution or hosted-service right.

The Change Date is March 1, 2030. The earlier four-year conversion specified in the license still applies. Apache-2.0 is the Change License. Already granted rights in earlier versions are not withdrawn, and this distribution does not rewrite earlier proprietary agreements or move an earlier promised conversion date later.

Some first-party files still carry a legacy proprietary header. For this distribution, the accompanying explicit license grant supplies the applicable permissions; a legacy header does not withdraw them. `LICENSE-HEADER.txt` is the replacement text for first-party files when maintainers update headers. Never apply that header to third-party code.

## Separately licensed materials

Paths beginning with `skills/`, `docs/` or `core/` below belong to the Micelclaw OS repository; paths explicitly labeled Dash belong to the Dash repository. Only materials present in a distribution are included.

- `skills/`: Apache-2.0 under its existing `LICENSE` and `NOTICE`.
- `docs/mcp-builder/`: retains its existing upstream license and notices.
- `core/data/design-systems/`: mixed MIT/Apache-2.0 sources and first-party material; retain the per-source attribution and applicable upstream license texts. Do not claim the imported catalog exclusively under BSL.
- `core/data/design-skills/`: first-party text with the provenance documented in its attribution; underlying third-party material retains its own rights.
- Dash's `src/vendor/foliate-js/`: MIT; retain its license and vendoring record.
- Dash's `src/modules/video/lib/stream-resolver.ts`: this file is distributed under MPL-2.0, preserving the existing Streamyfin adaptation notice; it is excluded from the BSL grant's scope.
- `micel-mail/admin-ui` and its accompanying Mailu/Micel Mail notices: MIT, published separately. Linking it does not relicense it.
- npm packages, OpenClaw, Node, system packages, containers, models and fonts: their own licenses. BSL does not replace their notices, source obligations or trademark rights.
- Provider logos and other trademarks: identification only under their existing provenance records; no endorsement or general trademark license is granted.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and preserve the existing `NOTICE` files. A binary release needs a dependency and asset inventory for the actual built artifact, including any MPL/LGPL or other source/relinking obligations. A source-package review is not approval of every binary redistribution.

## Contributions and commercial arrangements

Authors retain copyright. The manual [contributor agreement](CONTRIBUTOR_AGREEMENT.md) grants non-exclusive rights needed for BSL, Apache conversion and separate commercial licensing. It does not transfer third-party rights or claim an automated signing process. Separately licensed contributions retain their stated license.

Commercial licensing questions can be sent to legal@micelclaw.com. No subscription price, new commercial entitlement or approval to publish is created by this explanatory document.
