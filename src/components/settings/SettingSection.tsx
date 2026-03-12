/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

interface SettingSectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function SettingSection({ title, description, action, children }: SettingSectionProps) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3
          style={{
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: 'var(--text)',
            margin: '0 0 4px 0',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {title}
        </h3>
        {action}
      </div>
      {description && (
        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            margin: '0 0 12px 0',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {description}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}
