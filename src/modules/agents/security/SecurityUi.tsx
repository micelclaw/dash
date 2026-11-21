import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { securityHelp, type SecurityHelpKey } from './security-copy';

const HelpContext = createContext<{ open: string | null; setOpen: (id: string | null) => void }>({ open: null, setOpen: () => {} });
export function SecurityHelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  return <HelpContext.Provider value={{ open, setOpen }}>{children}</HelpContext.Provider>;
}
export function SecurityHelp({ topic }: { topic: SecurityHelpKey }) {
  const id = useId();
  const { open, setOpen } = useContext(HelpContext);
  const expanded = open === id;
  return <span className="contents">
    <Button type="button" size="icon" variant="ghost" aria-label={`Ayuda: ${securityHelp[topic][0]}`} aria-expanded={expanded} aria-controls={id} aria-describedby={expanded ? id : undefined}
      className="ml-1 inline-flex h-8 w-8 shrink-0 align-middle text-[var(--text-muted)]" onClick={() => { setOpen(expanded ? null : id); if (!expanded) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'nearest' })); }}
      onKeyDown={(event) => { if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(null); } }}><CircleHelp size={14} /></Button>
    <span id={id} hidden={!expanded} className="col-span-2 my-2 block border-l-2 border-[var(--border)] py-1 pl-3 text-xs font-normal leading-relaxed text-[var(--text-dim)]">{securityHelp[topic][1]}</span>
  </span>;
}
export type AspectStatus = { color: 'green' | 'orange' | 'red'; text: string; detail?: string };
const colors = { green: 'var(--success, #22c55e)', orange: 'var(--amber)', red: 'var(--error)' };
export function StatusText({ status }: { status: AspectStatus }) { return <span style={{ color: colors[status.color] }}>{status.text}</span>; }
export function StatusDot({ status }: { status: AspectStatus }) { return <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colors[status.color] }} />; }
export function SecurityButton({ className, ...props }: ButtonProps) { return <Button type="button" size="sm" className={cn('h-auto min-h-9 max-w-full whitespace-normal px-3 py-2 text-left leading-snug', className)} {...props} />; }
export function SecurityFacts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return <dl className="my-2 space-y-2 text-xs leading-relaxed">{rows.map(([label, value], i) => <div key={`${label}-${i}`} className="grid min-w-0 grid-cols-1 gap-1 @min-[390px]:grid-cols-[134px_minmax(0,1fr)] @min-[390px]:gap-3"><dt className="text-[var(--text-muted)]">{label}</dt><dd className="m-0 min-w-0 [overflow-wrap:anywhere] text-[var(--text-dim)]">{value}</dd></div>)}</dl>;
}
export function SecuritySection({ id, title, topic, status, hidden, nested = false, busy, children }: { id: string; title: string; topic: SecurityHelpKey; status?: AspectStatus; hidden?: boolean; nested?: boolean; busy?: boolean; children: ReactNode }) {
  const Heading = nested ? 'h4' : 'h3';
  return <section hidden={hidden} aria-labelledby={id} aria-busy={busy} className={cn('min-w-0 border-[var(--border)]', nested ? 'border-t pt-4' : 'border-b pb-6')}>
    <Heading id={id} tabIndex={-1} className={cn('m-0 mb-2 scroll-mt-4 font-semibold text-[var(--text)]', nested ? 'text-sm' : 'text-base')}>{title}<SecurityHelp topic={topic} /></Heading>
    {status && <p className="mb-3 text-xs leading-relaxed text-[var(--text-dim)]"><StatusText status={status} />{status.detail ? ` · ${status.detail}` : ''}</p>}{children}
  </section>;
}
export function InlineReview({ id, title, children, onCancel, cancelLabel = 'Volver a editar', actions }: { id: string; title: string; children: ReactNode; onCancel: () => void; cancelLabel?: string; actions: ReactNode }) {
  return <div className="mt-3 min-w-0 border-l-2 border-[var(--amber)] bg-[var(--card)] p-3 text-xs leading-relaxed text-[var(--text-dim)]" data-inline-review onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); } }}>
    <h4 id={id} tabIndex={-1} className="m-0 mb-2 scroll-mt-3 text-sm font-semibold text-[var(--text)]">{title}</h4>{children}<div className="mt-3 flex flex-wrap gap-2"><SecurityButton variant="outline" onClick={onCancel}>{cancelLabel}</SecurityButton>{actions}</div>
  </div>;
}
export function RadioChoice({ name, value, checked, disabled, onChange, label, description }: { name: string; value: string; checked: boolean; disabled?: boolean; onChange: () => void; label: string; description?: string }) {
  return <label className={cn('flex min-h-10 min-w-0 items-start gap-2 rounded-[var(--radius-sm)] px-2 py-2 text-[13px] leading-snug', checked ? 'bg-[var(--card)]' : '', disabled ? 'text-[var(--text-muted)]' : 'cursor-pointer text-[var(--text)] hover:bg-[var(--surface-hover)]')}>
    <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--amber)]" /><span className="min-w-0 [overflow-wrap:anywhere]">{label}{description && <small className="mt-1 block text-xs leading-relaxed text-[var(--text-muted)]">{description}</small>}</span>
  </label>;
}
export const settingClass = 'my-3 min-w-0 border-0 border-t border-[var(--border)] px-0 pt-3';
export const inputClass = 'mt-1 min-h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]';
export function focusSecurity(id: string) { requestAnimationFrame(() => { const el = document.getElementById(id); el?.focus({ preventScroll: true }); el?.scrollIntoView({ block: 'nearest' }); }); }
