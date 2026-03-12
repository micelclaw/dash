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
