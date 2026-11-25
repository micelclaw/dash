# Dash modules

Keep module composition, accessibility and shared component conventions
consistent.

- Reuse `src/components/ui/` primitives, Lucide React icons and TailwindCSS 4.
- Keep each domain module self-contained and put shared asynchronous state in its
  Zustand store.
- Changes to navigation or module visibility must account for both the desktop
  shell and the phone navigation in [Shell](../components/shell/Shell.tsx).
- For Gateway work, read [Gateway instructions](gateway/AGENTS.md) before editing.
