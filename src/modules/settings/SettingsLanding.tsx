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

/**
 * SettingsLanding — landing screen at /settings (no sub-route).
 *
 * Replaces the implicit "show General" default with an overview of
 * the 8 categories as cards. Each card lists the section count and
 * navigates to the first section of the group on click.
 *
 * The next iteration will add richer descriptions and "recently
 * viewed" once the user requests the didactic phase.
 */

import { useNavigate } from 'react-router';
import type { LucideIcon } from 'lucide-react';

export interface LandingGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  firstSectionId: string;
  sectionCount: number;
  /** Per-group accent color, must match the sidebar group icon. */
  color: string;
}

interface SettingsLandingProps {
  groups: LandingGroup[];
}

export function SettingsLanding({ groups }: SettingsLandingProps) {
  const navigate = useNavigate();

  return (
    <div>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: 'var(--text)',
          margin: '0 0 8px 0',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Settings
      </h1>
      <p
        style={{
          fontSize: '0.875rem',
          color: 'var(--text-muted)',
          margin: '0 0 32px 0',
          fontFamily: 'var(--font-sans)',
          maxWidth: 640,
        }}
      >
        Pick a category to get started. Use the search box on the left (press <kbd
          style={{
            padding: '1px 6px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface)',
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-mono)',
          }}
        >/</kbd>) to jump to any option quickly.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
          maxWidth: 1100,
        }}
      >
        {groups.map((g) => {
          const Icon = g.icon;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => navigate(`/settings/${g.firstSectionId}`)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 10,
                padding: '18px 18px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text)',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = g.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-sm)',
                    background: `color-mix(in srgb, ${g.color} 18%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: g.color,
                  }}
                >
                  <Icon size={18} />
                </div>
                <span
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                  }}
                >
                  {g.label}
                </span>
              </div>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {g.description}
              </p>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                  marginTop: 'auto',
                }}
              >
                {g.sectionCount} {g.sectionCount === 1 ? 'section' : 'sections'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
