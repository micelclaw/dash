# Micelclaw Dash

This is the portable, versioned Codex contract for Dash. `CLAUDE.md` and
`.claude/` are historical supplementary material, never the sole source of a
current rule.

- Dash is the React/Vite frontend for Micelclaw Core. Preserve the documented
  Core contract and do not guess backend fields or add raw API fallbacks.
- Use the package scripts for build, lint and E2E work; cross-repo E2E tests live
  in `../tests/dash`.
- Preserve the linked `@micelclaw/mail-admin-ui` sibling-repo workflow.
- Use the nested guidance in `src/services`, `src/stores`, `src/hooks`,
  `src/components` and `src/modules` for API/UI-specific work.
- The Micelclaw Gateway is a Dash module, not the upstream OpenClaw Control UI.
  For a Gateway/Models capture or provider catalog, first read
  `../micelclaw-os/docs/reference/codex-bootstrap.md`, then begin in
  `src/modules/gateway/`. Its versioned reference is `docs/gateway/models.md`.
- Do not change unrelated worktree files, generated `dist/` content or secrets.
- Verify claims and state the validation actually run. Require approval for push,
  publishing and external side effects.
