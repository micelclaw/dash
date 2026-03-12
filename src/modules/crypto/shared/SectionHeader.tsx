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

interface Props {
  title: string;
}

export function SectionHeader({ title }: Props) {
  return (
    <>
      <h3 className="crypto-section-hdr">{title}</h3>
      <style>{`
        .crypto-section-hdr { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
      `}</style>
    </>
  );
}
