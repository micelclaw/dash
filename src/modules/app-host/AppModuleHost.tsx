import { EntityShareModal } from '@/components/shared/EntityShareModal';
import { toast } from 'sonner';
import { officeHostNavigation, officeHostFileId, officeCopiedFileRoute,officeHostRequestedFile,officeOpenedFileRoute } from '@/modules/office/office-host-messages';
import { openOfficeDocument, type OfficeSlot } from '@/modules/office/office-providers.service';
import type { OfficeAgentFile } from '@/modules/office/OfficeAgentPanel';
import { useOfficeProviders } from '@/modules/office/office-providers.store';
import { compactOfficeChrome } from '@/modules/office/office-embed-chrome';
import { OfficeErrorState } from '@/modules/office/OfficeErrorState';
import { officeColor } from '@/config/office-colors';
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

// ─── App Module Host (iframe genérico) ───────────────────────────────
// Renderiza el módulo de una app L3 dinámica (servida por Core) como iframe a
// viewport completo. El iframe carga la UI same-origin de Core (/api/v1/app-ui/
// <app_name>/) → la cookie `claw_session` autentica (igual que el proxy de
// Mathesar). Ruta catch-all /app/:appName; el módulo viene del ui-modules store
// (ya filtrado por instalada+activa+cargada+concedida).

import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams, useBlocker, useLocation, Navigate } from 'react-router';
import { isLegacyDocumentsModule, legacyDocumentsTarget } from '@/modules/office/office-navigation';
import { PackageOpen, Loader2 } from 'lucide-react';
import { useEmbedFullscreen } from '@/hooks/use-embed-fullscreen';
import { EmbedActions } from '@/components/shared/EmbedActions';
import { useUiModulesStore } from '@/stores/ui-modules.store';
import { useServiceUrlsStore } from '@/stores/service-urls.store';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api';
import type { UiModule } from '@/services/app-access.service';
import { useSettingsStore } from '@/stores/settings.store';
import { useI18n } from '@/i18n';
import { useDriveStore } from '@/stores/drive.store';

// ─── OS theme bridge ─────────────────────────────────────────────────
// A module built with the "Micelclaw OS" design system carries a sentinel
// token (`--color-claw-theme-follow: 1`) in its bundled tokens.css. When
// such a module is embedded here (same-origin iframe) we map the dash's
// LIVE theme vars onto the module's `--color-*` so it tracks the user's
// chosen theme + accent. Standalone (export/web) the module has no sentinel
// and its static tokens render the default OS look. Apps built with ANY
// other design system lack the sentinel → this is a no-op for them.
const OfficeAgentPanel=lazy(()=>import('@/modules/office/OfficeAgentPanel'));
const OS_THEME_MAP: ReadonlyArray<readonly [appVar: string, dashVar: string]> = [
  ['--color-primary', '--amber'],
  ['--color-accent', '--amber-hover'],
  ['--color-background', '--bg'],
  ['--color-surface', '--surface'],
  ['--color-card', '--card'],
  ['--color-surface-hover', '--surface-hover'],
  ['--color-text', '--text'],
  ['--color-text-dim', '--text-dim'],
  ['--color-text-muted', '--text-muted'],
  ['--color-border', '--border'],
];

export function Component() {
  const {locale:language,t}=useI18n();const tRef=useRef(t);useEffect(()=>{tRef.current=t;},[t]);
  const { appName } = useParams<{ appName: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { fullscreen, toggle, rootStyle } = useEmbedFullscreen();

  const modules = useUiModulesStore((s) => s.modules);
  const loaded = useUiModulesStore((s) => s.loaded);
  const office = useOfficeProviders();
  const modernOffice = modules.some(m => m.app_name === appName && m.parent_module === 'office') || searchParams.get('office') === '1' || office.providers.some(p => p.app_name === appName);
  const isDocuments = appName === 'documents';
  const isOffice = isDocuments || modernOffice || ['spreadsheets','presentations','pdf'].includes(appName??'');
  useEffect(() => { if (isOffice) void office.refresh(); }, [isOffice, office.refresh]);
  const documentsFileId = searchParams.get('file');
  const officeFilePath = !modernOffice && isDocuments && documentsFileId && /^[a-f0-9-]{36}$/i.test(documentsFileId) ? `/office/edit/${documentsFileId}` : null;
  const [documentsState, setDocumentsState] = useState<{ locationKey: string; dirty: boolean; readOnly?:boolean; module?: UiModule }>({ locationKey: '', dirty: false });
  const documentsDirty = isOffice && documentsState.locationKey === location.key && documentsState.dirty;
  const liveMod = modules.find((m) => m.app_name === appName);
  const legacyDocuments = isLegacyDocumentsModule(liveMod);
  const officeSlot: OfficeSlot | undefined = (['documents','spreadsheets','presentations','pdf'] as const).find(slot => slot === liveMod?.office_provider?.slot) ?? office.providers.find(p => p.app_name === appName)?.slot ?? (isDocuments ? 'documents' : undefined);
  const [sharing, setSharing] = useState<{ id: string; filename: string; mime_type?: string } | null>(null);
  const [agentFile,setAgentFile]=useState<OfficeAgentFile|null>(null);
  useEffect(() => { setSharing(null);setAgentFile(null); }, [location.key]);
  // A grant refresh must not destroy unsaved changes; retain the existing frame
  // for local recovery. Core still validates every read and write.
  const mod = liveMod ?? (isOffice && documentsDirty ? documentsState.module : undefined);
  const blocker = useBlocker(isOffice && documentsDirty);
  const handlingBlock = useRef(false);
  useEffect(() => {
    if (blocker.state !== 'blocked') { handlingBlock.current = false; return; }
    if (handlingBlock.current) return;
    handlingBlock.current = true;
    if (window.confirm(tRef.current('office.host.leave'))) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  const [preparedLocation, setPreparedLocation] = useState<string | null>(null);
  const sessionReady = !isOffice || preparedLocation === location.key;
  const [sessionError, setSessionError] = useState(false);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  useEffect(() => {
    if (!isOffice || legacyDocuments || !documentsFileId) return;
    let current = true;
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      current = false;
      controller.abort();
      setSessionError(true);
    }, 30_000);
    setSessionError(false);
    // Wait for the existing HttpOnly session cookie before loading private assets.
    const prepare = async () => {
      // Revalidate the server-filtered availability at entry, not just the
      // possibly old module list captured when the shell started.
      await useUiModulesStore.getState().refresh();
      if (!current) return;
      if (!useUiModulesStore.getState().modules.some(module => module.app_name === appName)) {
        if (officeFilePath) navigate(officeFilePath, { replace: true });
        else setSessionError(true);
        return;
      }
      await api.post('/auth/session-cookie', undefined, { signal: controller.signal });
      if (current) { clearTimeout(deadline); setPreparedLocation(location.key); }
    };
    void prepare().catch(() => { if (current) { clearTimeout(deadline); setSessionError(true); } });
    return () => { current = false; clearTimeout(deadline); controller.abort(); };
  }, [isOffice, legacyDocuments, appName, sessionAttempt, location.key, officeFilePath, navigate, documentsFileId]);

  // A2: authenticate the embed with a `?token=` param (accepted by the auth
  // plugin), captured ONCE at mount so a later silent token refresh doesn't
  // reload the iframe. Without this, an expired `claw_session` cookie makes
  // the embed render a raw 401 JSON body instead of the app.
  const [embedToken] = useState<string | null>(() => useAuthStore.getState().tokens?.accessToken ?? null);

  // Reenvía la query string de ESTA ruta (p.ej. `?workflow=<id>` de una chip de
  // entidad de app) al iframe — la UI embebida (launcher de n8n, etc.) la lee de
  // su propia `window.location.search` para deep-linkear a un registro concreto.
  const iframeSrc = (() => {
    if (!mod) return undefined;
    const params = new URLSearchParams(searchParams);
    if (isOffice) params.delete('token');
    else if (embedToken) params.set('token', embedToken);
    const qs = params.toString();
    const sep = mod.iframe_url.includes('?') ? '&' : '?';
    return qs ? `${mod.iframe_url}${sep}${qs}` : mod.iframe_url;
  })();

  const primaryDomain = useServiceUrlsStore((s) => s.primaryDomain);
  const loadServiceUrls = useServiceUrlsStore((s) => s.load);
  useEffect(() => { void loadServiceUrls(); }, [loadServiceUrls]);
  const dashOrigin = primaryDomain ? `https://${primaryDomain}` : window.location.origin;

  // Feedback de carga del iframe: la app embebida (p.ej. n8n) puede hacer
  // cold-start del contenedor, y sin esto se ve el iframe en blanco. El key
  // del iframe lo remonta por app → reseteamos el flag al cambiar de app.
  const [iframeLoaded, setIframeLoaded] = useState(false);
  useEffect(() => { setIframeLoaded(false); }, [mod?.app_name]);
  const officeEntry = `${location.key}:${sessionAttempt}`;
  const [officeBoot, setOfficeBoot] = useState<{entry:string;ready:boolean;error?:string}>({entry:'',ready:false});
  const officeReady = officeBoot.entry === officeEntry && officeBoot.ready;
  const bootError = officeBoot.entry === officeEntry ? officeBoot.error : undefined;
  const frameReady = isOffice && !legacyDocuments ? officeReady : iframeLoaded;
  useEffect(() => {
    if (!isOffice || legacyDocuments || !sessionReady || officeReady) return;
    const timer = setTimeout(() => setOfficeBoot(previous => previous.entry === officeEntry && previous.ready
      ? previous : {entry:officeEntry,ready:false,error:tRef.current('office.host.bootTimeout')}),60_000);
    return () => clearTimeout(timer);
  }, [isOffice, legacyDocuments, sessionReady, officeReady, officeEntry]);

  // ─── OS theme bridge (see OS_THEME_MAP above) ────────────────────
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameBootObserver = useRef<MutationObserver | null>(null);
  const frameChrome = useRef<ReturnType<typeof compactOfficeChrome>>(undefined);
  useEffect(() => () => { frameBootObserver.current?.disconnect(); frameBootObserver.current = null; frameChrome.current?.destroy(); frameChrome.current = undefined; }, [officeEntry]);
  useEffect(() => {
    if (!isOffice) return;
    let active = true;
    let openingCopy: string | null = null;
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const message = event.data;
      if (message?.type === 'micelclaw:office-state' && message.provider === appName) {
        frameChrome.current?.refresh(message.readOnly === true || message.conflicted === true || !!message.error);
        // A loaded header is not a rendered editor. Keep loading until the
        // authenticated frame confirms the actual engine, or reports a failure.
        if (message.ready === true) setOfficeBoot({entry:officeEntry,ready:true});
        else if (message.ready === false && typeof message.error === 'string' && message.error) {
          setOfficeBoot(previous => previous.entry === officeEntry && previous.ready ? previous
            : {entry:officeEntry,ready:false,error:message.error});
        }
      }
      if ((message?.type === 'micelclaw:documents-state' || message?.type === 'micelclaw:office-state' && message.provider === appName) && typeof message.dirty === 'boolean') setDocumentsState(previous => ({ locationKey: location.key, dirty: message.dirty, readOnly:message.readOnly===true, module: liveMod ?? (previous.locationKey === location.key ? previous.module : undefined) }));
      // Save a copy/template keeps its real Core identity. Wait until the
      // engine confirms a clean file, then ask Core to authorize its opening.
      if (message?.type === 'micelclaw:office-state' && message.provider === appName && appName && officeSlot && liveMod && officeHostFileId(message.fileId) && message.fileId !== documentsFileId && message.ready === true && message.dirty === false && !message.saving && openingCopy !== message.fileId) {
        const fileId = message.fileId;
        openingCopy = fileId;
        void openOfficeDocument(fileId, appName).then(session => {
          const route=officeCopiedFileRoute(session,fileId,appName,officeSlot);
          if(!route)throw Error('Core no confirmó el archivo y proveedor de la copia.');
          if (active && route) navigate(route);
        }).catch(() => {
          if (active) { openingCopy = null; toast.error(tRef.current('office.host.copyOpenError')); }
        });
      }
      if (message?.type === 'micelclaw:documents-navigate' || message?.type === 'micelclaw:office-navigate' && message.provider === appName) {
        const path = officeHostNavigation(message.path, officeSlot, documentsFileId);
        if (path) navigate(path);
        else {
          const fileId=officeHostRequestedFile(message.path);
          if(fileId&&appName&&officeSlot&&liveMod&&openingCopy!==fileId){
            openingCopy=fileId;
            void openOfficeDocument(fileId,appName).then(session=>{
              const target=officeOpenedFileRoute(session,fileId,appName,officeSlot);
              if(!target)throw Error('Core no confirmó la apertura en esta aplicación.');
              if(active)navigate(target);
            }).catch(()=>{if(active){openingCopy=null;toast.error(tRef.current('office.host.openError'));}});
          }
        }
      }
      if (message?.type === 'micelclaw:office-agent' && message.provider === appName && liveMod && officeSlot && appName && officeHostFileId(documentsFileId)) {
        void api.get<{data:{id:string;filename:string}}>(`/files/${documentsFileId}`)
          .then(result=>{if(active&&result.data.id===documentsFileId)setAgentFile({...result.data,provider:appName,slot:officeSlot});})
          .catch(()=>toast.error(tRef.current('office.host.agentError')));
      }
      if (message?.type === 'micelclaw:office-share' && message.provider === appName && liveMod && officeHostFileId(documentsFileId)) {
        // Titles and access come from Core; an iframe cannot select another file.
        void api.get<{ data: { id: string; filename: string; mime_type?: string } }>(`/files/${documentsFileId}`)
          .then(result => { if (active&&result.data.id === documentsFileId) setSharing(result.data); })
          .catch(() => toast.error(tRef.current('office.host.shareError')));
      }
      if(message?.type==='micelclaw:office-versions'&&message.provider===appName&&liveMod&&officeHostFileId(documentsFileId)){
        void api.get<{data:{id:string}}>(`/files/${documentsFileId}`).then(result=>{
          if(!active||result.data.id!==documentsFileId)return;
          useDriveStore.getState().setInspectorTab('versions');
          useDriveStore.getState().setInspectorOpen(true);
          navigate(`/drive?tab=my-drive&id=${documentsFileId}`);
        }).catch(()=>{if(active)toast.error(tRef.current('office.host.versionsError'));});
      }
    };
    window.addEventListener('message', receive);
    return () => { active = false; window.removeEventListener('message', receive); };
  }, [isOffice, appName, navigate, documentsFileId, officeSlot, location.key, liveMod, officeEntry]);
  const themeName = useSettingsStore((s) => s.settings?.dash?.theme);
  const accentColor = useSettingsStore((s) => s.settings?.dash?.accent_color);
  const bgChoice = useSettingsStore((s) => s.settings?.dash?.background);
  const pushOsTheme = useCallback(() => {
    let doc: Document | null;
    try { doc = iframeRef.current?.contentDocument ?? null; } catch { doc = null; } // cross-origin → bail
    const appRoot = doc?.documentElement;
    if (!appRoot) return;
    if (isOffice) {
      appRoot.lang = language || document.documentElement.lang || 'en';
      iframeRef.current?.contentWindow?.postMessage({ type: 'micelclaw:office-theme', theme: themeName === 'light' ? 'light' : 'dark', locale: appRoot.lang }, window.location.origin);
    }
    // Opt-in: only OS-styled modules carry this sentinel token.
    if (!isOffice && getComputedStyle(appRoot).getPropertyValue('--color-claw-theme-follow').trim() !== '1') return;
    const dash = getComputedStyle(document.documentElement);
    for (const [appVar, dashVar] of OS_THEME_MAP) {
      const v = dash.getPropertyValue(dashVar).trim();
      if (v) appRoot.style.setProperty(appVar, v);
    }
    if (isOffice) for (const [appVar,dashVar] of [
      ['--page','--bg'],['--canvas','--bg'],['--surface','--surface'],['--surface-2','--card'],['--surface-3','--surface-hover'],
      ['--ink','--text'],['--ink-2','--text-dim'],['--ink-3','--text-muted'],['--muted','--text-dim'],
      ['--line','--border'],['--border','--border'],['--hairline','--border'],['--strong','--border'],['--accent','--amber'],['--brand','--amber'],
    ] as const) { const value = dash.getPropertyValue(dashVar).trim(); if (value) appRoot.style.setProperty(appVar,value); }
    if (isOffice && officeSlot === 'documents') {
      const light=themeName==='light';
      for(const [name,value] of Object.entries({
        '--ed-frame':light?'#f3f3f3':'#1f1f1f','--ed-card':light?'#ffffff':'#2b2b2b',
        '--ed-workspace':light?'#f3f3f3':'#1f1f1f','--ed-read-backdrop':light?'#f6f5f2':'#1f1f1f',
        '--canvas':light?'#f3f3f3':'#1f1f1f','--page':light?'#f3f3f3':'#1f1f1f',
        '--ed-ink':light?'#242424':'#e6e6e6','--ed-ink-2':light?'#424242':'#c8c8c8',
        '--ed-ink-3':light?'#616161':'#a8a8a8','--ed-line':light?'#e0e0e0':'#3a3a3a',
        '--ed-field':light?'#c7c7c7':'#555555','--ed-hover':light?'#f0f0f0':'#333333',
        '--ed-press':light?'#e0e0e0':'#3d3d3d',
      })) appRoot.style.setProperty(name,value);
    }
  }, [isOffice, officeSlot, language, themeName]);
  // Re-push after the dash applies a theme change (applyTheme runs in its
  // own effect on the same settings change; rAF guarantees we read the
  // updated values, not stale ones).
  useEffect(() => {
    const id = requestAnimationFrame(pushOsTheme);
    return () => cancelAnimationFrame(id);
  }, [themeName, accentColor, bgChoice, mod?.app_name, pushOsTheme]);

  // Keep any dirty, already mounted legacy frame available for recovery.
  // New entries always use Office's authorized dispatcher, never the old UI.
  if (legacyDocuments && !documentsDirty) return <Navigate replace to={legacyDocumentsTarget(documentsFileId)} />;
  // MicelHub's Open action has no file. Enter the corresponding Office tab
  // instead of mounting an editor that can never report a loaded document.
  if (isOffice && officeSlot && !documentsFileId && !documentsDirty) return <Navigate replace to={`/office?app=${officeSlot}`} />;

  // App no disponible (no instalada / no concedida / aún cargando los módulos).
  if (!mod) {
    if (isOffice && loaded) return <div style={{position:'absolute',inset:0,background:'var(--bg)',...rootStyle}}><OfficeErrorState message={t('office.host.unavailable')} color={officeColor(officeSlot??appName)} onRetry={()=>{void useUiModulesStore.getState().refresh();void office.refresh();}} /></div>;
    return (
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--text-dim)',
        background: 'var(--bg)',
      }}>
        <PackageOpen size={32} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 14 }}>
          {t(loaded ? 'office.host.unavailable' : 'office.host.loading')}
        </span>
        {loaded && (
          <button onClick={() => navigate('/micelhub')} style={retryBtn}>{t('office.host.micelhub')}</button>
        )}
      </div>
    );
  }

  const accent = officeColor(officeSlot) ?? mod.color ?? 'var(--accent)';

  // El título + icono del módulo ya los muestra la TopBar (resuelta contra el
  // ui-modules store), así que aquí NO repetimos una fila-header: el iframe va a
  // viewport completo y las acciones (pantalla completa + abrir en pestaña) se
  // superponen en la esquina, sin robar una fila entera.
  return (
    <div data-office-boot-phase={isOffice ? sessionError ? 'session-error' : !sessionReady ? 'preparing-session' : bootError ? 'engine-error' : frameReady ? 'ready' : 'loading-engine' : undefined} style={{ position: 'absolute', inset: 0, ...rootStyle }}>
      {!frameReady && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, background: 'var(--bg)', color: 'var(--text-dim)',
        }} role={sessionError || bootError ? undefined : 'status'}>
          {sessionError || bootError ? <OfficeErrorState
            message={sessionError?t('office.host.sessionError'):bootError}
            color={accent} retryDisabled={documentsDirty}
            onRetry={()=>{setPreparedLocation(null);setSessionAttempt(n=>n+1);}} />
            : <><Loader2 size={28} className="animate-spin" style={{color:accent}} />
              <span style={{fontSize:13}}>{t(isOffice&&!sessionReady?'office.host.preparingSession':'office.host.loadingApp',{name:mod.label})}</span></>}
        </div>
      )}
      {sessionReady && <iframe
        ref={iframeRef}
        key={isOffice ? `${mod.app_name}:${sessionAttempt}` : mod.app_name}
        src={iframeSrc}
        title={mod.label}
        onLoad={() => {
          frameBootObserver.current?.disconnect(); frameBootObserver.current = null;
          frameChrome.current?.destroy(); frameChrome.current = undefined;
          if (isOffice && !legacyDocuments) {
            let started = false;
            try {
              const doc = iframeRef.current?.contentDocument;
              started = !!doc?.querySelector('.mc-header');
              if (doc && appName) frameChrome.current = compactOfficeChrome(doc, appName);
              if (doc?.querySelector('#app[data-ready="true"]')) setOfficeBoot({entry:officeEntry,ready:true});
              else {
                const error = doc?.querySelector<HTMLElement>('[role="alert"]:not([hidden])');
                const message=error?.querySelector('[data-office-error-detail]')?.textContent??error?.textContent;
                if (message) setOfficeBoot({entry:officeEntry,ready:false,error:message});
              }
            } catch { /* unavailable same-origin app */ }
            if (!started) {
              if (officeFilePath) navigate(officeFilePath, { replace: true });
              else setOfficeBoot({entry:officeEntry,ready:false,error:tRef.current('office.host.bootError')});
              return;
            }
            // Documents 0.2.1 reports ready:false without an error payload.
            // Its same-origin error panel can appear after onLoad; surface that
            // failure while retaining the strict engine-ready gate and frame.
            const doc = iframeRef.current?.contentDocument;
            if (doc?.body) {
              const observeBoot = () => {
                if (doc.querySelector('#app[data-ready="true"]')) {
                  frameChrome.current?.refresh();
                  setOfficeBoot({ entry: officeEntry, ready: true });
                  frameBootObserver.current?.disconnect();
                  return;
                }
                const error = doc.querySelector<HTMLElement>('.mc-error[role="alert"]:not([hidden]), .mc-boot-error[role="alert"]:not([hidden])');
                const message = error?.querySelector('[data-office-error-detail]')?.textContent??error?.textContent;
                if (message) setOfficeBoot(previous => previous.entry === officeEntry && (previous.ready || previous.error === message)
                  ? previous : { entry: officeEntry, ready: false, error: message });
              };
              frameBootObserver.current = new MutationObserver(observeBoot);
              frameBootObserver.current.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'data-ready'] });
              observeBoot();
            }
            requestAnimationFrame(pushOsTheme);
            return;
          }
          setIframeLoaded(true); requestAnimationFrame(pushOsTheme);
        }}
        style={{ width: '100%', height: '100%', border: 'none', background: 'var(--bg)', display: 'block' }}
        allow="clipboard-read; clipboard-write"
      />}
      {agentFile && <Suspense fallback={<div role="status">{t('office.host.loadingAgent')}</div>}><OfficeAgentPanel file={agentFile} dirty={documentsDirty} readOnly={documentsState.readOnly===true} onClose={()=>setAgentFile(null)}/></Suspense>}
      {sharing && <EntityShareModal open entityType="file" entityId={sharing.id} entityTitle={sharing.filename}
        shareMeta={{ mime: sharing.mime_type, isDirectory: false }} onClose={() => setSharing(null)} />}
      {/* Acciones superpuestas en la esquina del iframe (fullscreen + abrir en
          pestaña). Semitransparente en reposo para no tapar la UI de la app;
          opaca al pasar el ratón. */}
      <div
        data-embed-floating-actions
        onFocusCapture={(e) => { e.currentTarget.style.opacity = '1'; }}
        onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.style.opacity = '0.55'; }}
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          display: 'flex', alignItems: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '3px 8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.28)',
          opacity: 0.55, transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.55'; }}
      >
        <EmbedActions
          slug={mod.app_name}
          fallbackUrl={mod.iframe_url}
          openUrl={`${dashOrigin}/app/${mod.app_name}?${new URLSearchParams({ fullscreen: '1', ...(isOffice && documentsFileId ? { file: documentsFileId, ...(modernOffice ? { office: '1' } : {}) } : {}) })}`}
          fullscreen={fullscreen}
          onToggleFullscreen={toggle}
        />
      </div>
    </div>
  );
}

const retryBtn: React.CSSProperties = {
  padding: '6px 16px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text)', cursor: 'pointer', fontSize: 13,
};
