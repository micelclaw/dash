# Dash API-backed stores

Keep server state, authentication and error/loading behavior consistent with the
service client.

- Consume typed service functions; stores do not issue raw HTTP requests.
- Preserve snake_case API data and the `{data}` envelope; do not add camelCase
  fallbacks.
- Derive mutation/loading state from the store or backend, not transient local UI
  state.
