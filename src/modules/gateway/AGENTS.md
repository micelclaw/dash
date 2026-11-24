# Dash Gateway module

The Gateway is Micelclaw's product UI for configuring and observing OpenClaw. It
is not OpenClaw's upstream Control UI.

## Routing

- Start with `GatewayPage.tsx` to resolve the top-level tab.
- For `Models`, `Chat`/`Conversación`, `Decision`/`Decisión`, `Catalog`, `Advanced`, provider cards, or a
  `Search providers` capture, start with `tabs/ModelsTab.tsx` and then
  `tabs/models/`. `configured` is the internal identifier for the Chat view;
  `Configured` may appear in older captures.
- Follow data through `src/stores/gateway.store.ts` and
  `src/services/gateway.service.ts` before changing UI behavior.
- The Decision view also calls `api` directly from `components/DecisionModelsView.tsx`;
  its Core routes are in `micelclaw-os/core/src/routes/managed-agents/decision-model.routes.ts`.
  Inspect that path as well when changing Decision behavior.
- The Core ownership for models is
  `micelclaw-os/core/src/routes/gateway/models.routes.ts` and
  `models-registry.routes.ts`; preserve its OpenClaw RPC/config-patch boundary.

## Guardrails

- Search exact visible UI text in this module before diagnosing a provider,
  catalog, cache, or runtime problem.
- Treat credentials as opaque: never expose, log or hardcode provider secrets.
- Do not invoke the OpenClaw CLI to mutate normal product configuration; the
  Core route and Gateway RPC boundary own those writes.
