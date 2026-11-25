# Dash API client

Preserve the existing Core API contract, error handling, auth/session behavior
and typed data boundary. Verify changed requests against its documented endpoint.

- Route every request through [the API client](api.ts); read it before adding a call.
- Preserve snake_case responses, the `{data}` envelope, automatic 401 refresh and
  the 204 early return before JSON parsing.
- Do not add camelCase fallback fields. ONLYOFFICE is the documented exception.
- Test fixtures and mocks must follow the actual endpoint contract, including its
  casing and any documented opt-out, rather than inventing a second response shape.
- Use `toast` from `sonner` for user-facing request feedback.
