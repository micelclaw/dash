import { SettingSection } from '../SettingSection';

interface ShortcutEntry {
  keys: string;
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutEntry[];
}

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
const CMD = isMac ? '\u2318' : 'Ctrl';

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: `${CMD} + K`, description: 'Open command palette' },
      { keys: `${CMD} + B`, description: 'Toggle sidebar' },
      { keys: 'Ctrl + Shift + V', description: 'Open clipboard panel' },
    ],
  },
  {
    title: 'Mail',
    shortcuts: [
      { keys: 'E', description: 'Archive selected email' },
      { keys: '#', description: 'Delete selected email' },
      { keys: 'R', description: 'Reply' },
      { keys: 'S', description: 'Toggle star' },
      { keys: 'U', description: 'Mark as unread' },
      { keys: 'Esc', description: 'Go back / deselect' },
    ],
  },
  {
    title: 'Notes & Diary',
    shortcuts: [
      { keys: `${CMD} + B`, description: 'Bold' },
      { keys: `${CMD} + I`, description: 'Italic' },
      { keys: `${CMD} + U`, description: 'Underline' },
      { keys: `${CMD} + Shift + X`, description: 'Strikethrough' },
    ],
  },
];

const kbdStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 22,
  height: 22,
  padding: '0 6px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  fontSize: '0.6875rem',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

export function ShortcutsSection() {
  return (
    <SettingSection title="Keyboard Shortcuts" description="Reference of available keyboard shortcuts.">
      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.title} style={{ padding: '8px 0' }}>
          <div style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 8,
            fontFamily: 'var(--font-sans)',
          }}>
            {group.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {group.shortcuts.map((s) => (
              <div
                key={s.keys}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                }}
              >
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
                  {s.description}
                </span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {s.keys.split(' + ').map((k, i) => (
                    <span key={i}>
                      {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem', margin: '0 1px' }}>+</span>}
                      <kbd style={kbdStyle}>{k.trim()}</kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </SettingSection>
  );
}
