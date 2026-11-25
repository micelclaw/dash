# Dash components

Preserve existing component conventions, accessibility and design consistency.

- Use primitives from `src/components/ui/`; do not create one-off replacements.
- Reuse [ConfirmDialog](shared/ConfirmDialog.tsx), [EmptyState](shared/EmptyState.tsx)
  and [MarkdownRenderer](markdown/MarkdownRenderer.tsx) for their respective cases.
- Use Lucide React for icons and TailwindCSS 4 for styling; do not add CSS
  modules or styled-components.
- Keep asynchronous domain state in its Zustand store rather than component-local
  state when that state must survive a render or be shared.
