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

// ─── Wizard de crear pool (4 pasos: nivel → discos → caché → confirmar) ──

import { useState } from 'react';
import { toast } from 'sonner';
import { HardDrive, Zap } from 'lucide-react';
import { useStorageStore } from '@/stores/storage.store';
import { SectionIntro, InfoTip } from '../ZfsHelp';
import { ZfsModal, ZfsButton, ZfsInput, Field, WarnBox, DiskPickList, useAvailableDisks, fmtTB } from './ZfsModal';
import { useI18n } from '@/i18n';

// Niveles RAID: mínimo de discos, tolerancia a fallos y fórmula de capacidad útil.
// `usable(n, smallest)` estima el espacio aprovechable según el nº de discos elegidos
// (usa el disco más pequeño, como hace ZFS), para mostrarlo en vivo en el wizard.
const TOPOLOGIES = [
  {
    id: 'mirror', labelKey: 'storage.raid.label.mirror', min: 2, tolKey: 'storage.raid.toleratesOne', copyKey: 'storage.raid.mirror',
    usable: (_n: number, smallest: number) => smallest, // espejo: capacidad de 1 disco
  },
  {
    id: 'raidz1', labelKey: 'storage.raid.label.raidz1', min: 3, tolKey: 'storage.raid.toleratesOne', copyKey: 'storage.raid.raidz1',
    usable: (n: number, smallest: number) => Math.max(0, n - 1) * smallest,
  },
  {
    id: 'raidz2', labelKey: 'storage.raid.label.raidz2', min: 4, tolKey: 'storage.raid.toleratesTwo', copyKey: 'storage.raid.raidz2',
    usable: (n: number, smallest: number) => Math.max(0, n - 2) * smallest,
  },
  {
    id: 'raidz3', labelKey: 'storage.raid.label.raidz3', min: 5, tolKey: 'storage.raid.toleratesThree', copyKey: 'storage.raid.raidz3',
    usable: (n: number, smallest: number) => Math.max(0, n - 3) * smallest,
  },
] as const;

export function CreatePoolWizard({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const demo = useStorageStore((s) => s.zfs_demo);
  const createPool = useStorageStore((s) => s.zfsCreatePool);
  const addCache = useStorageStore((s) => s.zfsAddCache);
  const [step, setStep] = useState(1);
  const [name, setName] = useState('tank');
  const [topology, setTopology] = useState<string>('raidz2');
  const [picked, setPicked] = useState<string[]>([]);
  const [encrypt, setEncrypt] = useState(false);
  const [cacheOpen, setCacheOpen] = useState(false);
  const [cacheDisks, setCacheDisks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const available = useAvailableDisks();

  const topo = TOPOLOGIES.find((t) => t.id === topology)!;
  const enoughDisks = picked.length >= topo.min;

  // Capacidad útil estimada en vivo según los discos de datos elegidos.
  const pickedDisks = available.filter((d) => picked.includes(d.by_id));
  const smallest = pickedDisks.length ? Math.min(...pickedDisks.map((d) => d.size_bytes)) : 0;
  const rawTotal = pickedDisks.reduce((acc, d) => acc + d.size_bytes, 0);
  const usable = pickedDisks.length ? topo.usable(pickedDisks.length, smallest) : 0;

  // Para la caché solo ofrecemos los discos NO seleccionados como datos.
  const cacheCandidates = available.filter((d) => !picked.includes(d.by_id));

  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleCache = (id: string) => setCacheDisks((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const submit = async () => {
    setBusy(true);
    try {
      await createPool({ name, topology, disk_by_ids: picked, encrypt });
      if (cacheDisks.length) {
        try { await addCache(name, 'cache', cacheDisks); }
        catch (e) { toast.error(t('storage.poolWizard.cacheError', { error: e instanceof Error ? e.message : String(e) })); }
      }
      toast.success(t('storage.poolWizard.created', { name, demo: demo ? t('storage.common.demoSuffix') : '' }));
      onClose();
    } catch (e) {
      toast.error(t('storage.poolWizard.createError', { error: e instanceof Error ? e.message : String(e) }));
    } finally { setBusy(false); }
  };

  const StepDots = () => (
    <div role="progressbar" aria-label={t('storage.poolWizard.title', { step })} aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} style={{
          height: 4, flex: 1, borderRadius: 2,
          background: n <= step ? 'var(--mod-storage, var(--accent))' : 'var(--border)',
        }} />
      ))}
    </div>
  );

  return (
    <ZfsModal title={t('storage.poolWizard.title', { step })} icon={<HardDrive size={18} style={{ color: 'var(--mod-storage)' }} />} onClose={onClose}
      footer={
        <>
          {step > 1 && <ZfsButton onClick={() => setStep(step - 1)}>{t('storage.poolWizard.back')}</ZfsButton>}
          <ZfsButton onClick={onClose}>{t('storage.common.cancel')}</ZfsButton>
          {step < 4 && <ZfsButton primary disabled={step === 2 && !enoughDisks} onClick={() => setStep(step + 1)}>{t('storage.poolWizard.next')}</ZfsButton>}
          {step === 4 && <ZfsButton primary disabled={busy || !enoughDisks} onClick={submit}>{busy ? t('storage.common.creating') : t('storage.poolWizard.create')}</ZfsButton>}
        </>
      }>
      <StepDots />

      {/* Paso 1: nivel de protección (RAID) */}
      {step === 1 && (
        <>
          <SectionIntro>{t('storage.help.pool')}</SectionIntro>
          <div>
            <Field hint={t('storage.poolWizard.nameHint')}>{t('storage.poolWizard.name')}</Field>
            <ZfsInput aria-label={t('storage.poolWizard.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder="tank" />
          </div>
          <div>
            <Field hint={t('storage.poolWizard.protectionHint')}>{t('storage.poolWizard.protection')}</Field>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>{t('storage.help.raidIntro')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TOPOLOGIES.map((topologyOption) => {
                const sel = topology === topologyOption.id;
                return (
                  <label key={topologyOption.id} style={{
                    display: 'flex', flexDirection: 'column', gap: 6, padding: 12,
                    border: `1px solid ${sel ? 'var(--mod-storage, var(--accent))' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    background: sel ? 'color-mix(in srgb, var(--mod-storage) 8%, transparent)' : 'transparent',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="radio" name="topo" checked={sel} onChange={() => setTopology(topologyOption.id)} />
                      <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{t(topologyOption.labelKey)}</span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>≥{topologyOption.min} · {t(topologyOption.tolKey)}</span>
                    </span>
                    {sel && <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{t(topologyOption.copyKey)}</span>}
                  </label>
                );
              })}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
            <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
            {t('storage.poolWizard.encrypt')}
            <InfoTip text={t('storage.poolWizard.encryptHint')} />
          </label>
        </>
      )}

      {/* Paso 2: elegir discos de datos */}
      {step === 2 && (
        <>
          <SectionIntro>{t('storage.poolWizard.chooseDisks', { minimum: topo.min, topology: t(topo.labelKey) })}</SectionIntro>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>{t('storage.poolWizard.selected', { count: picked.length, minimum: topo.min })}</div>
          <DiskPickList disks={available} picked={picked} onToggle={toggle} />
          {pickedDisks.length > 0 && (
            <div style={{
              padding: 12, borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--text)',
              background: 'color-mix(in srgb, var(--mod-storage) 8%, var(--surface))', border: '1px solid var(--border)',
            }}>
              {t('storage.poolWizard.estimate')} <strong>{fmtTB(usable)}</strong>
              <span style={{ color: 'var(--text-dim)' }}> {t('storage.poolWizard.rawCapacity', { capacity: fmtTB(rawTotal) })}</span>
            </div>
          )}
        </>
      )}

      {/* Paso 3: acelerar con caché SSD (opcional) */}
      {step === 3 && (
        <>
          <SectionIntro>{t('storage.help.cache')}</SectionIntro>
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: cacheOpen ? 'color-mix(in srgb, var(--mod-storage) 6%, transparent)' : 'transparent',
            }}
          >
            <Zap size={15} style={{ color: 'var(--mod-storage)' }} />
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{t('storage.poolWizard.cacheOptional')}</span>
            <input type="checkbox" checked={cacheOpen} onChange={() => setCacheOpen((v) => !v)} />
          </label>
          {cacheOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                {t('storage.poolWizard.cacheDescription')}
              </div>
              <DiskPickList disks={cacheCandidates} picked={cacheDisks} onToggle={toggleCache} emptyText={t('storage.poolWizard.cacheNone')} />
            </div>
          )}
          {!cacheOpen && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              {t('storage.poolWizard.skipCache')}
            </div>
          )}
        </>
      )}

      {/* Paso 4: confirmación con resumen humano + aviso de borrado */}
      {step === 4 && (
        <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionIntro>{t('storage.poolWizard.review')}</SectionIntro>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.6 }}>
            <div>{t('storage.poolWizard.pool')} <strong>{name}</strong></div>
            <div>{t('storage.poolWizard.protectionSummary')} <strong>{t(topo.labelKey)}</strong> — {t(topo.tolKey)}.</div>
            <div>{t('storage.poolWizard.dataDisks')} <strong>{picked.length}</strong> ({fmtTB(rawTotal)} {t('storage.poolWizard.raw')}).</div>
            <div>{t('storage.poolWizard.usable')} <strong>{fmtTB(usable)}</strong>.</div>
            <div>{t('storage.poolWizard.cache')} <strong>{cacheDisks.length ? t('storage.poolWizard.cacheDisks', { count: cacheDisks.length }) : t('storage.poolWizard.none')}</strong>.</div>
            <div>{t('storage.poolWizard.encryption')} <strong>{encrypt ? t('storage.poolWizard.yes') : t('storage.poolWizard.no')}</strong>.</div>
          </div>
          <WarnBox style={{ fontSize: '0.875rem' }}>
            {t('storage.poolWizard.eraseWarning', { count: picked.length, cache: cacheDisks.length ? t('storage.poolWizard.cacheEraseWarning', { count: cacheDisks.length }) : '' })}
            {!demo && t('storage.poolWizard.approvalWarning')}
          </WarnBox>
        </div>
      )}
    </ZfsModal>
  );
}
