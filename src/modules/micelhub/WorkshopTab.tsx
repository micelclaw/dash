/** Native OpenClaw10.7: personal library and learned agent procedures are separate. */
import { useCallback, useState } from 'react';
import { BookOpen, Code2, Copy, GraduationCap, Hammer, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { AppIcon, resolveManifestIcon } from '@/components/shared/AppIcon';
import { useChatStore } from '@/stores/chat.store';
import { useI18n } from '@/i18n';
import type { InstalledApp } from '@/types/apps';
import { SkillLibraryPanel } from './SkillLibraryPanel';
import { WorkshopLearnedPanel } from './WorkshopLearnedPanel';

type Source = 'mine' | 'team' | 'learned';
type WorkshopAction = { type: 'edit' | 'copy'; app: InstalledApp };
interface WorkshopTabProps {
  adaptedApps?: InstalledApp[];
  copyableApps?: InstalledApp[];
  onEditApp?(app: InstalledApp): void;
  onCreateCopy?(app: InstalledApp): void | Promise<void>;
}

export function WorkshopTab({ adaptedApps = [], copyableApps = [], onEditApp, onCreateCopy }: WorkshopTabProps = {}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [source, setSource] = useState<Source>('mine');
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<Source | null>(null);
  const [pendingAction, setPendingAction] = useState<WorkshopAction | null>(null);
  const [mount, setMount] = useState(0);
  const [adaptedId, setAdaptedId] = useState('');
  const [copyId, setCopyId] = useState('');
  const [copyBusy, setCopyBusy] = useState(false);
  const adaptedApp = adaptedApps.find((app) => app.id === adaptedId) ?? adaptedApps[0];
  const copyApp = copyableApps.find((app) => app.id === copyId) ?? copyableApps[0];
  const onDirty = useCallback((value: boolean) => setDirty(value), []);
  const teach = useCallback((agentName?: string) => {
    if (dirty) return;
    const chat = useChatStore.getState();
    if (agentName) chat.selectAgent(agentName);
    chat.startNewConversation();
    navigate('/chat');
  }, [dirty, navigate]);
  const choose = (value: Source) => {
    if (value === source) return;
    if (dirty) { setPending(value); setPendingAction(null); return; }
    setSource(value); setPending(null);
  };
  const runAction = async (action: WorkshopAction) => {
    if (action.type === 'edit') { onEditApp?.(action.app); return; }
    setCopyBusy(true);
    try { await onCreateCopy?.(action.app); } finally { setCopyBusy(false); }
  };
  const chooseAction = (action: WorkshopAction) => {
    if (dirty) { setPendingAction(action); setPending(null); return; }
    void runAction(action);
  };
  const discardAndContinue = () => {
    setDirty(false);
    setMount((value) => value + 1);
    if (pending) setSource(pending);
    const action = pendingAction;
    setPending(null); setPendingAction(null);
    if (action) void runAction(action);
  };

  return <div className="space-y-5 p-4 text-[var(--text-dim)] sm:p-5" data-testid="workshop107">
    <header className="flex items-start gap-3">
      <span className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-2.5 text-[var(--amber)]"><Hammer size={20} /></span>
      <div className="space-y-1"><h2 className="text-lg font-semibold text-[var(--text)]">{t('micelhub.workshop')}</h2><p className="max-w-2xl text-sm leading-relaxed">{t('micelhub.workshopDescription')}</p></div>
    </header>
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
      <div className="flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1" role="tablist" aria-label="Origen de habilidades">
        {(['mine', 'team', 'learned'] as const).map((value) => {
          const Icon = value === 'mine' ? BookOpen : value === 'team' ? Users : GraduationCap;
          return <Button key={value} role="tab" aria-selected={source === value} variant={source === value ? 'secondary' : 'ghost'} className={source === value ? 'bg-[var(--surface-hover)] text-[var(--text)]' : 'text-[var(--text-dim)]'} onClick={() => choose(value)}><Icon size={15} />{value === 'mine' ? 'Mi biblioteca' : value === 'team' ? 'Equipo' : 'Aprendidas por agente'}</Button>;
        })}
      </div>
      {(pending || pendingAction) && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><p>Hay una edición sin guardar. ¿Descartar el borrador para continuar?</p><Button variant="destructive" size="sm" onClick={discardAndContinue}>{pending ? 'Descartar y cambiar' : 'Descartar y continuar'}</Button><Button variant="outline" size="sm" onClick={() => { setPending(null); setPendingAction(null); }}>Seguir editando</Button></div>}
      {source === 'learned' ? <WorkshopLearnedPanel key={`learned-${mount}`} onTeach={teach} /> : <SkillLibraryPanel key={`${source}-${mount}`} scope={source} onDirty={onDirty} onTeach={teach} />}
      {dirty && <p role="status" className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-[var(--amber)]">Borrador sin guardar. Guarda o descarta antes de cambiar de origen o abrir un chat.</p>}
    </section>
    {(onEditApp || onCreateCopy) && <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5" aria-label={t('micelhub.workshopApps')}>
      <div className="flex items-start gap-2.5"><Code2 size={18} className="mt-0.5 shrink-0 text-[var(--amber)]" /><div className="space-y-1"><h3 className="text-sm font-semibold text-[var(--text)]">{t('micelhub.workshopApps')}</h3><p className="text-xs leading-relaxed">{t('micelhub.workshopAppsDescription')}</p></div></div>
      <div className="grid gap-4 lg:grid-cols-2">
        {onEditApp && <div className="space-y-2">
          {adaptedApps.length ? <><label className="block text-xs font-medium text-[var(--text)]" htmlFor="workshop-adapted-app">{t('micelhub.adapted')}</label><div className="flex flex-wrap items-center gap-2">
            <select id="workshop-adapted-app" value={adaptedApp?.id ?? ''} onChange={(event) => setAdaptedId(event.target.value)} className="h-8 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]">{adaptedApps.map((app) => <option value={app.id} key={app.id}>{app.manifest?.name || app.app_name}</option>)}</select>
            <Button variant="outline" size="sm" disabled={!adaptedApp} onClick={() => adaptedApp && chooseAction({ type: 'edit', app: adaptedApp })}><Code2 size={13} />{t('micelhub.editFiles')}</Button>
          </div></> : <p className="text-xs">{t('micelhub.workshopNoAdaptedApps')}</p>}
        </div>}
        {onCreateCopy && copyableApps.length > 0 && <div className="space-y-2"><label className="block text-xs font-medium text-[var(--text)]" htmlFor="workshop-copy-app">{t('micelhub.workshopCopyFrom')}</label><div className="flex flex-wrap items-center gap-2">
          {copyApp && <AppIcon {...resolveManifestIcon(copyApp.manifest)} size={18} />}
          <select id="workshop-copy-app" value={copyApp?.id ?? ''} onChange={(event) => setCopyId(event.target.value)} className="h-8 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]">{copyableApps.map((app) => <option value={app.id} key={app.id}>{app.manifest?.name || app.app_name}</option>)}</select>
          <Button variant="outline" size="sm" disabled={!copyApp || copyBusy} onClick={() => copyApp && chooseAction({ type: 'copy', app: copyApp })}><Copy size={13} />{t('micelhub.workshopCreateCopy')}</Button>
        </div></div>}
      </div>
    </section>}
  </div>;
}
