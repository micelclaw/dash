# Dash API-backed hooks

Do not duplicate API contract logic that belongs in the services layer.

- Read `src/services/api.ts` before adding API-backed behavior.
- Keep requests in `src/services/`; hooks orchestrate them but never use raw
  `fetch`.
- Preserve the Core snake_case contract and the documented `{data}` envelope.
