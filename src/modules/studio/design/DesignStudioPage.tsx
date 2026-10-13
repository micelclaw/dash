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

// ─── Design workbench — the Claude-Design-style canvas experience ────
//
// The SAME canvas serves two surfaces (convergence, ADR-17 amendment):
//   · target='design' projects (DesignStudioPage thin wrapper, no phase
//     rail, full chrome: Export / Publish / "Build this app"), and
//   · the Frontend phase of ANY project (FrontendPhase embeds it with
//     chrome='frontend-phase': the phase panel owns Approve; export/
//     publish/convert hidden — the output is the derived doc + build).
// Flow:
//   1. Intro: describe → pick feel/colors → Generate (3 variants, A/B/C).
//   2. Variant picker: view each, "Use this design" pins it (+ design.md).
//   3. Canvas: pages rail (+ one-click screen suggestions from the
//      concept) · sandboxed canvas with element selection · instruction
//      bar (edit-with-AI, scoped, optional apply-across-pages) · inline
//      text edit (no LLM) · brand color knobs · history · actions.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ChevronLeft, Loader2, Sparkles, Plus, Trash2, Monitor, Smartphone,
  Type, Wand2, History, Palette, X, Check, ArrowRight, Download, AlertTriangle, Eye, Scissors,
} from 'lucide-react';
import { toast } from 'sonner';
import type { StudioProject } from '@/stores/studio.store';
import { defaultTokensFromFeel } from '../lib/mockups';
import { useConfirm } from '../lib/useConfirm';
import { ConnectExternalEngineModal } from '../components/v2/ConnectExternalEngineModal';
import {
  listDesignPages, generateInitialVariants, selectDesignVariant, fixPageBrand,
  createDesignPage, editDesignPage, saveDeterministicVersion,
  listDesignVersions, getDesignVersion, revertDesignVersion, deleteDesignPage,
  updateDesignTokens, fetchProjectTokensCss,
  patchElementText, listUserDomains, getProjectSite, publishProjectSite,
  unpublishSite, fetchScreenSuggestions,
  fetchDesignTemplates, fetchDesignTemplate, fetchBriefQuestions,
  updateIntake, continueBuildInStudio,
  type DesignPage,
  type DesignAudit, type PageIncomplete, type SystemDomainOption, type PublishedSiteInfo,
  type DesignBriefQuestion, type DesignTemplateMeta,
} from './design.service';
import { briefAnswers, briefNeedsBackend, briefNeedsUi, briefRecommendedTarget, briefRecommendationReason, briefAgreementRows } from './brief-intel';
import { DesignCanvas, type CanvasSelection, type DesignCanvasHandle } from './DesignCanvas';
import { useStudioStreamsStore } from '../streams/studio-generation-streams';
import { useStudioStore } from '@/stores/studio.store';
import { BriefQuestionnaire } from './BriefQuestionnaire';
import { ConvertDesignModal } from './ConvertDesignModal';
import { TourStrip } from '../components/TourStrip';
import { DesignSystemPicker } from '../components/DesignSystemPicker';
import { DesignSystemGalleryModal } from '../components/DesignSystemGalleryModal';
import { DesignPreview } from '../components/DesignPreview';
import { templateIcon } from './template-icons';
import { downloadAuthed } from '@/lib/file-download';

export interface DesignWorkbenchProps {
  project: StudioProject;
  onExit: () => void;
  /** Refetch the project (after continue-build converts it). */
  onProjectChanged?: () => void;
  /** 'design' (default): full chrome. 'frontend-phase': embedded in the
   *  Frontend phase — no Back/Export/Publish/convert; the parent injects
   *  its own `actions` (Approve frontend, View spec). */
  chrome?: 'design' | 'frontend-phase';
  /** Extra top-bar actions injected by the embedding phase. */
  actions?: React.ReactNode;
  /** Fires whenever the page set changes — lets the embedding phase know
   *  whether a direction is picked (enables its Approve). */
  onPagesChanged?: (pages: DesignPage[]) => void;
  /** Read-only surface (past views): no instruction bar, no knobs, no
   *  add/delete/history — just look at the design. UX affordance only;
   *  the server-side phase guard remains the real write barrier. */
  readOnly?: boolean;
}

const FEELS = [
  { id: 'elegant', label: 'Elegant' },
  { id: 'fresh', label: 'Fresh' },
  { id: 'warm', label: 'Warm' },
  { id: 'minimal', label: 'Minimal' },
] as const;

// One-click iteration starters for the frontend phase — the instruction
// bar absorbs the old "Iterate on the document" panel (B7).
const CANVAS_SUGGESTIONS = [
  'Make it more minimal',
  'Try a darker palette',
  'Bigger, bolder typography',
  'More whitespace between sections',
];

/** Thin wrapper kept for target='design' projects (full chrome). */
export function DesignStudioPage(props: Omit<DesignWorkbenchProps, 'chrome' | 'actions' | 'onPagesChanged'>) {
  return <DesignWorkbench {...props} chrome="design" />;
}

export function DesignWorkbench({ project, onExit, onProjectChanged, chrome = 'design', actions, onPagesChanged, readOnly = false }: DesignWorkbenchProps) {
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirm();
  const canvasRef = useRef<DesignCanvasHandle | null>(null);

  const [pages, setPages] = useState<DesignPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokensCss, setTokensCss] = useState<string | null>(null);
  const [designMds, setDesignMds] = useState<Record<string, string | null>>({});

  // Intro state
  const [prompt, setPrompt] = useState(project.description ?? '');
  const [feel, setFeel] = useState<string>('minimal');
  const [brandColors, setBrandColors] = useState('');
  const [generating, setGenerating] = useState(false);

  // Three-step intake (unified funnel, ADR-18): compose → questions →
  // agreement (the questionnaire's summary IS "the agreement"). The
  // sub-step + answers persist server-side (PATCH /intake) so an F5
  // resumes; on mount we rehydrate from project.design_brief.
  const [introStep, setIntroStep] = useState<'compose' | 'questions' | 'agreement'>(() => {
    const saved = project.design_brief?.intake?.step;
    return saved === 'questions' || saved === 'agreement' ? saved : 'compose';
  });
  const [dTemplates, setDTemplates] = useState<DesignTemplateMeta[]>([]);
  const [templateSlug, setTemplateSlug] = useState<string | null>(project.design_brief?.template ?? null);
  const [starterHtml, setStarterHtml] = useState<string | null>(null);
  const [designSystemSlug, setDesignSystemSlug] = useState<string | null>(project.design_system ?? null);
  const [previewTokens, setPreviewTokens] = useState<string | null>(null);
  const [briefQuestions, setBriefQuestions] = useState<DesignBriefQuestion[]>(
    () => (project.design_brief?.questions ?? []) as DesignBriefQuestion[],
  );
  const [briefAnswers, setBriefAnswers] = useState<Record<string, string>>(
    () => ({ ...(project.design_brief?.answers ?? {}) }),
  );
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  // How many creative directions to generate (1 / 3 / 5) — like Open Design.
  const [directionCount, setDirectionCount] = useState<1 | 3 | 5>(3);
  // Opt-in self-critique (extra LLM pass per variant → OFF by default here:
  // this box's free models can go silent, and each pass adds that risk).
  const [autoRefine, setAutoRefine] = useState(false);
  const fetchDesignSystemTokens = useStudioStore((s) => s.fetchDesignSystemTokens);

  const designChromeIntro = chrome === 'design';
  useEffect(() => {
    if (!designChromeIntro) return;
    let cancelled = false;
    fetchDesignTemplates().then((t) => { if (!cancelled) setDTemplates(t); }).catch(() => {});
    return () => { cancelled = true; };
  }, [designChromeIntro]);

  // Resume-at-questions (merged create screen lands here with step already
  // 'questions', and an F5 mid-questionnaire does too): fetch the
  // questionnaire once if it isn't persisted yet. One shot per mount so a
  // failed fetch never loops.
  const questionsFetchedRef = useRef(false);
  useEffect(() => {
    if (!designChromeIntro || introStep !== 'questions') return;
    if (briefQuestions.length > 0 || loadingQuestions || questionsFetchedRef.current) return;
    questionsFetchedRef.current = true;
    setLoadingQuestions(true);
    fetchBriefQuestions(project.id, templateSlug)
      .then((qs) => setBriefQuestions(qs))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Couldn\'t prepare the questions'))
      .finally(() => setLoadingQuestions(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designChromeIntro, introStep, briefQuestions.length, loadingQuestions]);

  // Instant preview: the chosen template's starter themed by the chosen
  // design system's tokens — zero LLM, the "see something now" effect.
  useEffect(() => {
    if (!templateSlug) { setStarterHtml(null); return; }
    let cancelled = false;
    fetchDesignTemplate(templateSlug)
      .then((t) => { if (!cancelled) setStarterHtml(t.starter_html); })
      .catch(() => { if (!cancelled) setStarterHtml(null); });
    return () => { cancelled = true; };
  }, [templateSlug]);
  useEffect(() => {
    if (!designSystemSlug) { setPreviewTokens(null); return; }
    let cancelled = false;
    fetchDesignSystemTokens(designSystemSlug)
      .then((css) => { if (!cancelled) setPreviewTokens(css); })
      .catch(() => { if (!cancelled) setPreviewTokens(null); });
    return () => { cancelled = true; };
  }, [designSystemSlug, fetchDesignSystemTokens]);

  // Live generation progress: the 3 directions generate SEQUENTIALLY and
  // each streams `studio.generation.*` events (phase design_page) into the
  // global streams store — surface them so the skeleton never looks frozen.
  const genStream = useStudioStreamsStore((s) => s.streams[`${project.id}:design_page`]);
  const [doneDirections, setDoneDirections] = useState(0);
  const prevGenStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    const st = genStream?.status;
    if (st === 'done' && prevGenStatus.current !== 'done') {
      if (generating) setDoneDirections((n) => Math.min(directionCount, n + 1));
      // The model stopped at its output ceiling: the screen it just produced
      // is cut off, not finished. Saying nothing was how a half-drawn page
      // became indistinguishable from a complete one.
      if (genStream?.truncatedByModel) {
        toast.warning('The model ran out of room — that screen came out cut off. Generate it again or ask for something simpler.');
      }
    }
    prevGenStatus.current = st;
  }, [genStream?.status, genStream?.truncatedByModel, generating]);

  // Canvas state
  const [activePageId, setActivePageId] = useState<string | null>(null);
  // Brand audit (server-computed on read; only offending pages are keyed).
  const [audit, setAudit] = useState<Record<string, DesignAudit>>({});
  // Pantallas que quedaron cortadas (TR1). Mismo patrón que la auditoría de
  // marca: lo deriva el servidor al leer, aquí solo se pinta.
  const [incomplete, setIncomplete] = useState<Record<string, PageIncomplete>>({});
  const [incompleteOpenFor, setIncompleteOpenFor] = useState<string | null>(null);
  // Para dejar el cursor en la barra tras prellenar la instrucción: el botón
  // de la insignia escribe el texto, no lo ejecuta.
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const [auditOpenFor, setAuditOpenFor] = useState<string | null>(null);
  const [fixingPageId, setFixingPageId] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [selection, setSelection] = useState<CanvasSelection | null>(null);
  // Versión que se estaba viendo cuando se capturó la selección. Viaja con la
  // edición: el servidor solo puede editar por fragmento —sin reescribir el
  // documento entero— si sigue siendo la actual, porque `claw_id` es un índice
  // posicional y solo es exacto mientras el documento no cambie.
  const [selectionBaseVersion, setSelectionBaseVersion] = useState<number | null>(null);
  const [instruction, setInstruction] = useState('');
  const [applyAll, setApplyAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingPage, setAddingPage] = useState(false);
  const [addingPageName, setAddingPageName] = useState<string | null>(null);
  // Inline "Add screen" mini-form (window.prompt is dead: it gave zero
  // progress feedback and can't be styled/cancelled consistently).
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [addFormName, setAddFormName] = useState('');
  const [showKnobs, setShowKnobs] = useState(false);
  const [knobColors, setKnobColors] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);
  // Previsualización de una versión antigua: SOLO LECTURA. Mirar no escribe
  // (antes la única forma de ver v1 era restaurarla, y eso creaba v3, v4, v5…).
  const [preview, setPreview] = useState<{ version: number; html: string; source: string; instruction: string | null } | null>(null);
  const [compareCurrent, setCompareCurrent] = useState(false);
  // Mientras se previsualiza, TODO lo que lee o escribe la versión actual se
  // bloquea: el servidor edita/exporta/publica siempre contra la actual, así
  // que ver una y actuar sobre otra sería peor que el bug que esto arregla.
  // Flag propio y no `readOnly`: ese oculta el botón de History.
  const [contentWarning, setContentWarning] = useState<{ pageName: string; missing: string[]; lost: number; backTo: number } | null>(null);
  const [versions, setVersions] = useState<Array<{ version: number; source: string; instruction: string | null; created_at: string }>>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const exportBaseName = useMemo(
    () => (project.name || 'design').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design',
    [project.name],
  );
  const [showConnect, setShowConnect] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [domains, setDomains] = useState<SystemDomainOption[]>([]);
  const [publishDomainId, setPublishDomainId] = useState('');
  const [publishSlug, setPublishSlug] = useState('');
  const [site, setSite] = useState<PublishedSiteInfo | null>(null);
  const [publishing, setPublishing] = useState(false);

  const designChrome = chrome === 'design';
  const [screenSuggestions, setScreenSuggestions] = useState<string[]>([]);

  const variants = pages.filter((p) => p.variant_group === 'initial');
  const realPages = useMemo(() => pages.filter((p) => !p.variant_group), [pages]);
  const activePage = realPages.find((p) => p.id === activePageId)
    ?? variants.find((p) => p.id === activePageId)
    ?? realPages[0] ?? variants[0] ?? null;

  const effectiveTokens = tokensCss ?? defaultTokensFromFeel(feel, brandColors, project.name);

  // Let the embedding phase track the picked/unpicked state (Approve gate).
  useEffect(() => { onPagesChanged?.(pages); }, [pages, onPagesChanged]);

  // Frontend phase: one-click screen suggestions scanned from the concept.
  useEffect(() => {
    if (designChrome) return;
    let cancelled = false;
    fetchScreenSuggestions(project.id)
      .then((s) => { if (!cancelled) setScreenSuggestions(s); })
      .catch(() => { /* suggestions are sugar, never an error */ });
    return () => { cancelled = true; };
  }, [designChrome, project.id, realPages.length]);

  const refresh = useCallback(async () => {
    const res = await listDesignPages(project.id);
    setPages(res.pages);
    setAudit(res.audit ?? {});
    setIncomplete(res.incomplete ?? {});
    const css = await fetchProjectTokensCss(project.id);
    setTokensCss(css);
    return res;
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load the design');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  // Seed knob colors from the tokens css when it changes.
  useEffect(() => {
    const css = effectiveTokens ?? '';
    const grab = (name: string) => new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(css)?.[1];
    setKnobColors({
      primary: grab('primary') ?? '#6366f1',
      accent: grab('accent') ?? '#f59e0b',
      background: grab('background') ?? '#ffffff',
    });
  }, [effectiveTokens]);

  const overridesCss = useMemo(() => {
    const entries = Object.entries(knobColors)
      .map(([k, v]) => `--color-${k}: ${v};`).join(' ');
    return entries ? `:root { ${entries} }` : '';
  }, [knobColors]);

  // ─── Actions ─────────────────────────────────────────────────────

  // Kick off the questionnaire: the LLM tailors visual questions to the
  // description/template (+ the fixed functional block). Server-side
  // fallback bank guarantees questions even when the model fails.
  async function startQuestions() {
    if (!prompt.trim()) {
      toast.message('Describe what we\'re designing first.');
      return;
    }
    setIntroStep('questions');
    // Persist the draft (F5-safe) — best-effort, never blocks the step.
    void updateIntake(project.id, {
      step: 'questions',
      template: templateSlug,
      design_system: designSystemSlug,
      description: prompt.trim(),
    }).catch(() => {});
    // Questions already persisted from a previous visit → don't re-bill.
    if (briefQuestions.length > 0) return;
    setLoadingQuestions(true);
    try {
      const qs = await fetchBriefQuestions(project.id, templateSlug);
      setBriefQuestions(qs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn\'t prepare the questions');
      setBriefQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }

  // questions → agreement: persist the answers so the summary (and the
  // no-UI Continue, which never calls /design/generate) read durable state.
  async function goToAgreement() {
    setIntroStep('agreement');
    void updateIntake(project.id, {
      step: 'agreement',
      answers: briefAnswers,
      template: templateSlug,
      design_system: designSystemSlug,
    }).catch(() => {});
  }

  // The no-UI branch: an automation/agent-skill has no screens to design —
  // the agreement's confirm IS the Continue (target auto-commits to the OS
  // module; nothing else can host a background automation).
  const [makingPlan, setMakingPlan] = useState(false);
  async function continueWithoutScreens() {
    if (makingPlan) return;
    setMakingPlan(true);
    try {
      await updateIntake(project.id, { answers: briefAnswers, confirmed: true });
      await continueBuildInStudio(project.id, 'micelclaw_app');
      toast.success('The plan is ready to write — no screens needed for this one');
      onProjectChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn\'t continue to the plan');
      setMakingPlan(false);
    }
  }

  // TR4(c): ANY rewrite of the page invalidates the selected element. `claw_id`
  // is a POSITIONAL index recomputed on every render, so a selection kept
  // across a rewrite no longer points at the node the user clicked — and it
  // travels into the next prompt as "the user selected this" and into the
  // inline text editor. Every path that replaces the HTML calls this.
  const dropSelection = useCallback(() => {
    setSelection(null);
    setSelectionBaseVersion(null);
    canvasRef.current?.clearSelection();
  }, []);

  async function handleGenerate() {
    if (!prompt.trim() || generating) return;
    dropSelection();
    setGenerating(true);
    setDoneDirections(0);
    // Generating IS the agreement's confirm for the UI branch (ADR-18).
    if (designChromeIntro) {
      void updateIntake(project.id, { confirmed: true }).catch(() => {});
    }
    try {
      const res = await generateInitialVariants(project.id, designChromeIntro
        ? {
          prompt: prompt.trim(),
          design_system: designSystemSlug ?? project.design_system ?? undefined,
          brief_answers: briefAnswers,
          direction_count: directionCount,
          critique: autoRefine,
        }
        : {
          prompt: prompt.trim(),
          feel,
          brand_colors: brandColors.trim() || undefined,
          design_system: project.design_system ?? undefined,
          direction_count: directionCount,
          critique: autoRefine,
        });
      setPages(res.pages);
      const map: Record<string, string | null> = {};
      for (const d of res.design_mds) if (d.page_id) map[d.page_id] = d.design_md;
      setDesignMds(map);
      const first = res.pages.find((p) => p.variant_group === 'initial');
      if (first) setActivePageId(first.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  // "Fix" = compose the instruction from the CURRENT audit and route it
  // through the normal edit endpoint → new version, same history, revertible.
  async function handleFixBrand(pageId: string) {
    setFixingPageId(pageId);
    // The model re-emits the WHOLE document here, so the selection is stale
    // the moment this returns.
    dropSelection();
    try {
      const res = await fixPageBrand(project.id, pageId);
      if (!res.fixed) {
        toast.success('Nothing to fix — this screen already follows the design system');
      } else if ((res.after ?? 0) === 0) {
        toast.success(`Fixed ${res.before} brand issue${res.before === 1 ? '' : 's'}`);
      } else {
        toast.warning(`${res.before} → ${res.after} issues left. Run it again or fix the rest by hand.`);
      }
      if (res.content_warning) {
        const page = (res.pages ?? pages).find((p) => p.id === pageId);
        setContentWarning({
          pageName: page?.name ?? 'this screen',
          missing: res.content_warning.missing,
          lost: res.content_warning.lost,
          backTo: Math.max(1, (res.version ?? (page?.version ?? 2)) - 1),
        });
      }
      if (res.pages) setPages(res.pages);
      setAudit((prev) => {
        const next = { ...prev };
        if (res.audit.ok) delete next[pageId]; else next[pageId] = res.audit;
        return next;
      });
      if (res.fixed) setAuditOpenFor(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not fix this screen');
    } finally {
      setFixingPageId(null);
    }
  }

  async function handlePickVariant(page: DesignPage) {
    setBusyAction('pick');
    try {
      const updated = await selectDesignVariant(project.id, page.id, designMds[page.id] ?? null);
      setPages(updated);
      setActivePageId(updated.find((p) => !p.variant_group)?.id ?? null);
      const css = await fetchProjectTokensCss(project.id);
      setTokensCss(css);
      toast.success('Design direction pinned');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to pick the variant');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleEditWithAI() {
    if (!activePage || !instruction.trim() || editing) return;
    setEditing(true);
    try {
      const res = await editDesignPage(project.id, activePage.id, {
        instruction: instruction.trim(),
        element: selection ? {
          claw_id: selection.claw_id, tag: selection.tag,
          path: selection.path, outer_html: selection.outer_html,
        } : undefined,
        apply_all: applyAll && realPages.length > 1,
        based_on_version: selection && selectionBaseVersion !== null ? selectionBaseVersion : undefined,
      });
      setPages(res.pages);
      setInstruction('');
      dropSelection();
      // Toast HONESTO: "aplicar a todas" puede fallar en algunas pantallas y
      // hasta ahora se cantaba éxito contando solo las que salieron bien.
      const failed = res.failed ?? [];
      if (applyAll && (res.applied.length > 1 || failed.length)) {
        const total = res.applied.length + failed.length;
        if (failed.length) toast.warning(`Applied to ${res.applied.length} of ${total} screens — ${failed.map((f) => f.name).join(', ')} failed`);
        else toast.success(`Applied across ${res.applied.length} screens`);
      } else {
        toast.success('Page updated');
      }
      // Aviso de contenido perdido: se muestra el de la pantalla activa (o el
      // primero de las demás) con un Deshacer que vuelve a la versión previa.
      const w = res.content_warning
        ? { pageName: activePage.name, warning: res.content_warning }
        : (res.warned ?? []).length
          ? { pageName: res.warned![0]!.name, warning: res.warned![0]!.warning }
          : null;
      if (w) {
        const applied = res.applied.find((a) => a.page_id === activePage.id);
        setContentWarning({
          pageName: w.pageName,
          missing: w.warning.missing,
          lost: w.warning.lost,
          backTo: Math.max(1, (applied?.version ?? activePage.version + 1) - 1),
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Edit failed');
    } finally {
      setEditing(false);
    }
  }

  const handleTextEdited = useCallback((clawId: number, newText: string) => {
    void (async () => {
      const page = pages.filter((p) => !p.variant_group).find((p) => p.id === activePageId) ?? pages.find((p) => !p.variant_group);
      if (!page) return;
      const patched = patchElementText(page.html, clawId, newText);
      if (!patched) { toast.error("Couldn't apply the text change"); return; }
      try {
        await saveDeterministicVersion(project.id, page.id, patched, selection ? {
          claw_id: clawId, tag: selection.tag, path: selection.path, outer_html: '',
        } : null);
        await refresh();
        // `patchElementText` rewrites the document and SHIFTS the claw_id
        // index (deleting children moves every later node), so holding on to
        // the old selection would address a different element.
        dropSelection();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save the text change');
      }
    })();
  }, [pages, activePageId, project.id, selection, refresh, dropSelection]);

  async function addPageNamed(name: string) {
    setAddingPage(true);
    setAddingPageName(name);
    try {
      const res = await createDesignPage(project.id, name);
      setPages(res.pages);
      setActivePageId(res.page_id);
      if (res.fallback) toast.message('The engine struggled with that screen — a template placeholder was added, try editing it.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add the screen');
    } finally {
      setAddingPage(false);
      setAddingPageName(null);
    }
  }

  async function handleDeletePage(page: DesignPage) {
    const ok = await confirm({
      title: `Delete "${page.name}"?`,
      body: 'The screen and its history will be removed from the design.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      const updated = await deleteDesignPage(project.id, page.id);
      setPages(updated);
      if (activePageId === page.id) {
        // The screen holding the selected element is gone.
        dropSelection();
        setActivePageId(updated.find((p) => !p.variant_group)?.id ?? null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function handleSaveKnobs() {
    setBusyAction('knobs');
    try {
      await updateDesignTokens(project.id, knobColors);
      const css = await fetchProjectTokensCss(project.id);
      setTokensCss(css);
      toast.success('Brand colors saved — they apply to every page');
      setShowKnobs(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save colors');
    } finally {
      setBusyAction(null);
    }
  }

  async function openHistory() {
    if (!activePage) return;
    setShowHistory(true);
    try {
      setVersions(await listDesignVersions(project.id, activePage.id));
    } catch { /* toast on revert instead */ }
  }

  // Ver una versión antigua = LECTURA. No escribe nada, así que comparar
  // v1 con v2 y volver ya no deja un reguero de versiones nuevas.
  async function handlePreviewVersion(version: number) {
    if (!activePage) return;
    if (version === activePage.version) { exitPreview(); return; }
    try {
      const v = await getDesignVersion(project.id, activePage.id, version);
      dropSelection();
      setCompareCurrent(false);
      setPreview({ version: v.version, html: v.html, source: v.source, instruction: v.instruction });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load that version');
    }
  }

  function exitPreview() {
    setPreview(null);
    setCompareCurrent(false);
    dropSelection();
  }

  async function handleRevert(version: number) {
    if (!activePage) return;
    try {
      const res = await revertDesignVersion(project.id, activePage.id, version);
      await refresh();
      setShowHistory(false);
      exitPreview();
      if (activePage) setVersions(await listDesignVersions(project.id, activePage.id).catch(() => versions));
      toast.success(res.created ? `Back to version ${version}` : `Already on version ${version}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revert failed');
    }
  }

  async function openPublish() {
    setShowPublish(true);
    setShowExport(false);
    try {
      const [doms, existing] = await Promise.all([listUserDomains(), getProjectSite(project.id)]);
      setDomains(doms);
      setSite(existing);
      if (existing) {
        setPublishSlug(existing.host.split('.')[0] ?? '');
      } else if (!publishSlug) {
        setPublishSlug(project.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'my-site');
      }
      const primary = doms.find((d) => d.is_primary) ?? doms[0];
      if (primary) setPublishDomainId((cur) => cur || primary.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load your domains');
    }
  }

  async function handlePublish() {
    if (!publishDomainId || !publishSlug.trim() || publishing) return;
    setPublishing(true);
    try {
      const res = await publishProjectSite(project.id, {
        system_domain_id: publishDomainId,
        subdomain: publishSlug.trim(),
      });
      setSite({ id: res.id, host: res.host, status: 'published', current_release: res.release });
      toast.success(`Live at ${res.url}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!site) return;
    const ok = await confirm({
      title: `Take ${site.host} offline?`,
      body: 'The address stops serving the site. Your design and its releases are kept — you can publish again anytime.',
      confirmLabel: 'Unpublish',
      danger: true,
    });
    if (!ok) return;
    try {
      await unpublishSite(site.id);
      setSite(null);
      toast.success('Site unpublished');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unpublish failed');
    }
  }

  // "Build it…" opens the conversion modal (app vs website) — the modal
  // owns the POST and its 30-90s derive progress.

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
        <Loader2 size={16} className="spin" /> Loading your design…
      </div>
    );
  }

  // 1 — Intro (no pages yet). Design chrome = two-step composer (template
  // + design system + description → LLM questionnaire → generate); the
  // frontend-phase keeps the classic single-step intro (its brief is the
  // approved concept).
  if (pages.length === 0) {
    const themedStarter = starterHtml
      ? (previewTokens
        ? (/<head[^>]*>/i.test(starterHtml)
          ? starterHtml.replace(/<head([^>]*)>/i, `<head$1><style>${previewTokens}</style>`)
          : `<style>${previewTokens}</style>${starterHtml}`)
        : starterHtml)
      : null;
    return (
      <div style={{ maxWidth: designChrome ? 1040 : 640, margin: '0 auto', padding: '32px 24px', fontFamily: 'var(--font-sans)' }}>
        {designChrome && <button onClick={onExit} style={ghostBtn}><ChevronLeft size={14} /> Back to my apps</button>}

        {designChrome && introStep === 'questions' ? (
          <>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: '18px 0 4px' }}>
              A few quick questions
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: '0 0 16px' }}>
              So the three directions fit you rather than a generic template.
            </p>
            {loadingQuestions ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '22px 0', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                <Loader2 size={15} className="spin" style={{ color: 'var(--amber)' }} />
                Preparing a few questions for you… usually ~15s
              </div>
            ) : (
              <BriefQuestionnaire
                questions={briefQuestions}
                answers={briefAnswers}
                onChange={setBriefAnswers}
                disabled={generating}
              />
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => setIntroStep('compose')} disabled={generating} style={ghostBtn}>
                <ChevronLeft size={13} /> Back
              </button>
              <button onClick={() => { void goToAgreement(); }} disabled={loadingQuestions} style={primaryBtn(loadingQuestions)}>
                Review <ArrowRight size={14} />
              </button>
            </div>
          </>
        ) : designChrome && introStep === 'agreement' ? (
          // ── The AGREEMENT (ADR-18): the intake's deterministic summary
          // card — instant, no LLM, no spinner (R-B by construction). This
          // replaces the old visible concept phase; the concept doc is
          // derived silently at Continue.
          (() => {
            const needsUi = briefNeedsUi(briefAnswers);
            const layoutName = dTemplates.find((t) => t.slug === templateSlug)?.name ?? null;
            const rows = briefAgreementRows(briefAnswers, {
              layoutName,
              styleName: designSystemSlug ?? project.design_system ?? null,
            });
            return (
              <>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: '18px 0 4px' }}>
                  Let's make sure I got it
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: '0 0 16px' }}>
                  This is what we're making. If it looks right, {needsUi ? 'we design it next.' : 'we plan it next.'}
                </p>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{project.name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
                    {prompt.trim() || project.description || '(no description)'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {rows.map((r) => (
                      <div key={r.label} style={{ display: 'flex', gap: 10, fontSize: '0.78rem', lineHeight: 1.45 }}>
                        <span style={{ color: 'var(--text-muted)', minWidth: 96, flexShrink: 0 }}>{r.label}</span>
                        <span style={{ color: 'var(--text)' }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                  {!needsUi && (
                    <p style={{ margin: '14px 0 0', fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      This one doesn't need screens — it'll work quietly behind the scenes.
                      We can skip the design and go straight to the plan.
                    </p>
                  )}
                  <p style={{ margin: '12px 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Anything off? Go back and change it — nothing is locked in.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, gap: 12, flexWrap: 'wrap' }}>
                  <button onClick={() => setIntroStep('questions')} disabled={generating || makingPlan} style={ghostBtn}>
                    <ChevronLeft size={13} /> Back
                  </button>
                  {needsUi ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                      <label title="Extra AI review+polish pass per option (slower)" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-dim)', cursor: 'pointer', userSelect: 'none' }}>
                        <input type="checkbox" checked={autoRefine} onChange={(e) => setAutoRefine(e.target.checked)} disabled={generating} style={{ accentColor: 'var(--amber)' }} />
                        Auto-refine
                      </label>
                      <DirectionToggle value={directionCount} onChange={setDirectionCount} disabled={generating} />
                      <button onClick={() => { void handleGenerate(); }} disabled={generating} style={primaryBtn(generating)}>
                        {generating
                          ? <><Loader2 size={14} className="spin" /> Designing {directionCount} direction{directionCount > 1 ? 's' : ''}… usually 1–2 min</>
                          : <>That's it — let's design <ArrowRight size={14} /></>}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                      <button
                        onClick={() => {
                          const appOption = 'An app with its own screens';
                          setBriefAnswers((a) => ({ ...a, fn_shape: appOption }));
                          void updateIntake(project.id, { answers: { fn_shape: appOption } }).catch(() => {});
                        }}
                        disabled={makingPlan}
                        style={ghostBtn}
                      >
                        Actually, I do want screens
                      </button>
                      <button onClick={() => { void continueWithoutScreens(); }} disabled={makingPlan} style={primaryBtn(makingPlan)}>
                        {makingPlan
                          ? <><Loader2 size={14} className="spin" /> Setting everything up… usually under a minute</>
                          : <>Sounds right — make the plan <ArrowRight size={14} /></>}
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })()
        ) : (
          <>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: '18px 0 4px' }}>
              {designChrome ? 'What are we designing?' : "Let's design your screens"}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: '0 0 16px' }}>
              {designChrome
                ? "Describe it, pick a starting point, and I'll ask a few quick questions before proposing three directions."
                : "I'll propose three visual directions based on what we agreed in the concept. You pick one and refine every screen on the canvas."}
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={generating}
              placeholder={'E.g.: "A landing page for my dog-grooming studio, with prices and a booking form"'}
              style={textArea}
            />

            {designChrome ? (
              <>
                {/* Eje 1 — Start with a template… (structural) */}
                {dTemplates.length > 0 && (
                  <div style={{ margin: '14px 0 0' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8 }}>
                      Start with a template…
                    </div>
                    {/* Grid that WRAPS (no horizontal scroll) — all patterns visible at once. */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
                      {dTemplates.map((t) => {
                        const active = templateSlug === t.slug;
                        const Icon = templateIcon(t.slug);
                        return (
                          <button
                            key={t.slug}
                            type="button"
                            onClick={() => {
                              const next = active ? null : t.slug;
                              setTemplateSlug(next);
                              // First-party pairing: "Micelclaw Module" belongs with
                              // the "Micelclaw OS" style — auto-select it when the user
                              // hasn't picked a system yet (never override a choice).
                              if (next === 'micelclaw-module' && !designSystemSlug) {
                                setDesignSystemSlug('micelclaw-os');
                              }
                            }}
                            disabled={generating}
                            title={t.description}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                              padding: '12px 8px',
                              background: active ? 'color-mix(in srgb, var(--amber) 8%, var(--card))' : 'var(--card)',
                              border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
                              borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            }}
                          >
                            <Icon size={20} strokeWidth={1.6} style={{ color: active ? 'var(--amber)' : 'var(--text-dim)' }} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>{t.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Eje 2 — Design system (visual language, catálogo S4) */}
                <div style={{ margin: '14px 0 0' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                      Design system <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — a known visual language as base)</span>
                    </span>
                    <div style={{ flex: 1 }} />
                    <button
                      type="button"
                      onClick={() => setShowGallery(true)}
                      disabled={generating}
                      style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--amber)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 }}
                    >
                      Browse all →
                    </button>
                  </div>
                  <DesignSystemPicker
                    value={designSystemSlug}
                    onSelect={setDesignSystemSlug}
                    disabled={generating}
                    compact
                    hidePreview
                  />
                </div>

                {/* Single prominent preview — reflects the CURRENT selection:
                    the template's structure × the design system's tokens (the
                    key ask: "blog" previews differently than "landing"). Falls
                    back to the system's own sample when no template is picked. */}
                {(themedStarter || designSystemSlug) && (
                  <div style={{ margin: '16px 0 0' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
                      Preview <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                        {templateSlug ? '— this template, themed by your design system (the directions personalize the content)' : '— your design system (pick a template to preview its structure)'}
                      </span>
                    </div>
                    {themedStarter ? (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#fff' }}>
                        <iframe title="Template preview" sandbox="" srcDoc={themedStarter} style={{ width: '100%', height: 340, border: 'none', display: 'block' }} />
                      </div>
                    ) : (
                      <DesignPreview slug={designSystemSlug!} />
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <button onClick={() => { void startQuestions(); }} disabled={!prompt.trim() || generating} style={primaryBtn(!prompt.trim() || generating)}>
                    Continue <ArrowRight size={13} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
                  {FEELS.map((f) => (
                    <button key={f.id} onClick={() => setFeel(f.id)} disabled={generating} style={chip(feel === f.id)}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <input
                  value={brandColors}
                  onChange={(e) => setBrandColors(e.target.value)}
                  disabled={generating}
                  placeholder='Brand colors (optional): "deep green and cream", #16a34a…'
                  style={{ ...textArea, minHeight: 0, height: 38, resize: 'none' as const }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <button onClick={() => { void handleGenerate(); }} disabled={!prompt.trim() || generating} style={primaryBtn(!prompt.trim() || generating)}>
                    {generating
                      ? <><Loader2 size={14} className="spin" /> Designing 3 directions… usually 1–2 min</>
                      : <><Sparkles size={14} /> Explore 3 directions</>}
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {generating && (
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: `repeat(${Math.min(directionCount, 3)}, 1fr)`, gap: 10 }}>
            {['A', 'B', 'C', 'D', 'E'].slice(0, directionCount).map((l, i) => {
              const isDone = i < doneDirections;
              const isActive = i === doneDirections;
              const chars = isActive ? (genStream?.text?.length ?? 0) : 0;
              const thinking = isActive && chars === 0 && (genStream?.reasoning?.length ?? 0) > 0;
              return (
                <div
                  key={l}
                  style={{
                    height: 160, borderRadius: 8,
                    border: `1px solid ${isDone ? '#22c55e' : isActive ? 'var(--amber)' : 'var(--border)'}`,
                    background: 'var(--card)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontSize: '0.8rem',
                  }}
                >
                  {isDone
                    ? <Check size={16} style={{ color: '#22c55e' }} />
                    : isActive ? <Loader2 size={16} className="spin" style={{ color: 'var(--amber)' }} /> : null}
                  <span style={{ color: isDone || isActive ? 'var(--text)' : 'var(--text-muted)', fontWeight: 600 }}>
                    Direction {l}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {isDone
                      ? 'ready'
                      : isActive
                        ? (chars > 0 ? `drawing… ${(chars / 1000).toFixed(1)}k chars` : thinking ? 'thinking…' : 'starting…')
                        : 'waiting…'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {showGallery && (
          <DesignSystemGalleryModal
            value={designSystemSlug}
            onSelect={setDesignSystemSlug}
            onClose={() => setShowGallery(false)}
            projectId={project.id}
          />
        )}
        {confirmDialog}
      </div>
    );
  }

  // 2 — Variant picker (A/B/C unpicked)
  if (variants.length > 0 && realPages.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
        <div style={topBar}>
          {designChrome && <button onClick={onExit} style={ghostBtn}><ChevronLeft size={14} /> Back</button>}
          <strong style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Pick a direction</strong>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>view each one, then "Use this design"</span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => { setPages([]); setActivePageId(null); setIntroStep('compose'); setDoneDirections(0); }}
            style={ghostBtn}
          >Start over</button>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
          {variants.map((v) => (
            <button key={v.id} onClick={() => setActivePageId(v.id)} style={chip(activePage?.id === v.id)}>
              Direction {v.variant_label}
            </button>
          ))}
          {activePage && (
            <button
              onClick={() => { void handlePickVariant(activePage); }}
              disabled={busyAction === 'pick'}
              style={{ ...primaryBtn(false), marginLeft: 'auto', padding: '5px 14px' }}
            >
              {busyAction === 'pick' ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Use this design
            </button>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {activePage && (
            <DesignCanvas
              ref={canvasRef}
              // Each variant carries its own identity in its var() fallbacks —
              // don't flatten them with a shared token layer before the pick.
              pageHtml={activePage.html}
              tokensCss={null}
              device={device}
              onSelect={() => { /* selection disabled until picked */ }}
              onTextEdited={() => { /* not editable yet */ }}
            />
          )}
        </div>
        {confirmDialog}
      </div>
    );
  }

  // 3 — Main canvas experience
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', minHeight: 0 }}>
      {/* Top bar */}
      <div style={topBar}>
        {designChrome && <button onClick={onExit} style={ghostBtn}><ChevronLeft size={14} /> Back</button>}
        <strong style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{project.name}</strong>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 999, padding: '1px 8px' }}>
          {designChrome ? 'Design' : 'Frontend'}
        </span>
        {readOnly && (
          <span style={{ fontSize: '0.68rem', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: 999, padding: '1px 8px' }}>
            read-only
          </span>
        )}
        <div style={{ flex: 1 }} />
        <div style={segmented}>
          <button onClick={() => setDevice('desktop')} style={segBtn(device === 'desktop')} aria-label="Desktop"><Monitor size={13} /></button>
          <button onClick={() => setDevice('mobile')} style={segBtn(device === 'mobile')} aria-label="Mobile"><Smartphone size={13} /></button>
        </div>
        {!readOnly && (
          <button onClick={() => setShowKnobs((v) => !v)} disabled={!!preview} style={{ ...ghostBtn, opacity: preview ? 0.45 : 1 }} title={preview ? 'Back to the current version to change colours' : 'Brand colors'}>
            <Palette size={13} /> Colors
          </button>
        )}
        {!readOnly && <button onClick={() => { void openHistory(); }} style={ghostBtn} title="Version history"><History size={13} /> History</button>}
        <button
          onClick={() => navigate(`/studio`)}
          style={{ display: 'none' }}
          aria-hidden
        />
        {designChrome && !readOnly && (
        <button onClick={() => setShowConvert(true)} disabled={!!preview} style={primaryBtn(!!preview)} title={preview ? 'Back to the current version to continue' : undefined}>
          Continue <ArrowRight size={13} />
        </button>
        )}
        {actions}
        {designChrome && !readOnly && (
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowExport((v) => !v)} disabled={!!preview} style={{ ...ghostBtn, opacity: preview ? 0.45 : 1 }} title={preview ? 'Back to the current version to export' : 'Export & handoff'}>
            <Download size={13} /> Export & handoff
          </button>
          {showExport && (
            <div style={{ ...popover, top: 34, right: 0, width: 280, position: 'absolute' }}>
              <button
                type="button"
                onClick={() => {
                  setShowExport(false);
                  void downloadAuthed(
                    `/api/v1/studio/projects/${project.id}/design/export?format=zip`,
                    `${exportBaseName}.zip`,
                  );
                }}
                style={{ ...exportItem, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <strong>Download ZIP</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Self-contained HTML pages + an index — open anywhere.</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExport(false);
                  void downloadAuthed(
                    `/api/v1/studio/projects/${project.id}/design/export?format=open-design`,
                    `${exportBaseName}-open-design.zip`,
                  );
                }}
                style={{ ...exportItem, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <strong>Export for Open Design</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>DESIGN.md + tokens.css + pages/ — the open standard layout.</span>
              </button>
              <button
                type="button"
                onClick={() => { setShowExport(false); setShowConnect(true); }}
                style={{ ...exportItem, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <strong>Open in my own tool</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Hand the design to YOUR Claude Code / Cursor to implement it.</span>
              </button>
              <button
                type="button"
                onClick={() => { void openPublish(); }}
                style={{ ...exportItem, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <strong>Publish as a website</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Serve it live at name.your-domain from this server.</span>
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Publish dialog */}
      {showPublish && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowPublish(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, fontFamily: 'var(--font-sans)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text)' }}>Publish as a website</strong>
              <button onClick={() => setShowPublish(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}><X size={15} /></button>
            </div>
            {site && (
              <div style={{ padding: '8px 10px', marginBottom: 12, borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, #22c55e 10%, transparent)', border: '1px solid #22c55e', fontSize: '0.75rem', color: 'var(--text)' }}>
                Live at <a href={`https://${site.host}`} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>https://{site.host}</a> (release {site.current_release}).
                Publishing again updates it in place.
              </div>
            )}
            {domains.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                You don't have a system domain yet. Add one in Settings › Domains first — then any
                name under it (like <code>my-site.victor.claw</code>) can serve this design.
              </p>
            ) : (
              <>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 4, fontWeight: 500 }}>Address</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
                  <input
                    value={publishSlug}
                    onChange={(e) => setPublishSlug(e.target.value.toLowerCase())}
                    placeholder="my-site"
                    style={{ ...textArea, minHeight: 0, height: 36, resize: 'none' as const, flex: 1 }}
                  />
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>.</span>
                  <select
                    value={publishDomainId}
                    onChange={(e) => setPublishDomainId(e.target.value)}
                    style={{ height: 36, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', padding: '0 8px', maxWidth: 180 }}
                  >
                    {domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {site && (
                    <button onClick={() => { void handleUnpublish(); }} style={{ ...ghostBtn, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                      Unpublish
                    </button>
                  )}
                  <button onClick={() => { void handlePublish(); }} disabled={!publishSlug.trim() || !publishDomainId || publishing} style={primaryBtn(!publishSlug.trim() || !publishDomainId || publishing)}>
                    {publishing ? <><Loader2 size={13} className="spin" /> Publishing…</> : <>{site ? 'Publish update' : 'Publish'}</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {showConnect && (
        <ConnectExternalEngineModal
          projectId={project.id}
          onClose={() => setShowConnect(false)}
        />
      )}
      {showConvert && (
        <ConvertDesignModal
          projectId={project.id}
          needsBackend={designNeedsBackend(project)}
          recommendedTarget={briefRecommendedTarget(project.design_brief?.answers ?? {})}
          recommendationReason={briefRecommendationReason(project.design_brief?.answers ?? {})}
          onClose={() => setShowConvert(false)}
          onConverted={() => { setShowConvert(false); onProjectChanged?.(); }}
        />
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Pages rail */}
        <div style={{ width: 190, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--card)' }}>
          <div style={{ padding: '10px 12px', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>
            Screens
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {realPages.map((p) => (
              <div
                key={p.id}
                onClick={() => { setActivePageId(p.id); dropSelection(); }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  background: activePage?.id === p.id ? 'color-mix(in srgb, var(--amber) 8%, transparent)' : 'transparent',
                  borderLeft: activePage?.id === p.id ? '2px solid var(--amber)' : '2px solid transparent',
                  fontSize: '0.8rem', color: 'var(--text)',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                {incomplete[p.id] && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setIncompleteOpenFor(incompleteOpenFor === p.id ? null : p.id); }}
                    title="This screen was cut short"
                    aria-label={`${p.name} was cut short`}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', color: 'var(--text-muted)',
                    }}
                  >
                    <Scissors size={11} />
                  </button>
                )}
                {audit[p.id] && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setAuditOpenFor(auditOpenFor === p.id ? null : p.id); }}
                    title={`${audit[p.id]!.issues.length} thing${audit[p.id]!.issues.length === 1 ? '' : 's'} off-brand`}
                    aria-label={`Brand check: ${audit[p.id]!.issues.length} issues on ${p.name}`}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', gap: 2, color: 'var(--amber)',
                    }}
                  >
                    <AlertTriangle size={11} />
                    <span style={{ fontSize: '0.6rem', fontWeight: 600 }}>{audit[p.id]!.issues.length}</span>
                  </button>
                )}
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>v{p.version}</span>
                {realPages.length > 1 && !readOnly && !preview && (
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleDeletePage(p); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
            {/* "Esta pantalla quedó cortada" (TR1). El botón NO regenera:
                deja la instrucción escrita en la barra y decide el usuario —
                una pantalla cortada conserva intacto todo lo anterior al
                corte, y rehacerla tiraría un diseño que quizá le gustaba. */}
            {incompleteOpenFor && incomplete[incompleteOpenFor] && (
              <div style={{
                margin: '2px 10px 8px', padding: '8px 10px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, var(--text-muted) 6%, transparent)',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text)', fontWeight: 600 }}>
                  This screen was cut short
                </span>
                <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  The design stops mid-way — it ends without finishing.
                  {incomplete[incompleteOpenFor]!.guillotine
                    ? ' It hit an old size limit that no longer exists, so completing it now works.'
                    : ' Completing it adds what is missing and leaves the rest untouched.'}
                </span>
                {!readOnly && !preview && (
                  <button
                    onClick={() => {
                      setActivePageId(incompleteOpenFor);
                      setInstruction(incomplete[incompleteOpenFor]!.suggested_instruction);
                      setIncompleteOpenFor(null);
                      instructionRef.current?.focus();
                    }}
                    style={{ ...ghostBtn, justifyContent: 'center', fontSize: '0.68rem', padding: '4px 8px' }}
                  >
                    <Wand2 size={11} /> Write the instruction
                  </button>
                )}
              </div>
            )}
            {/* Brand-check detail for the screen whose badge is open.
                Advisory: we report, we never rewrite without being asked. */}
            {auditOpenFor && audit[auditOpenFor] && (
              <div style={{
                margin: '2px 10px 8px', padding: '8px 10px',
                border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, var(--amber) 6%, transparent)',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text)', fontWeight: 600 }}>
                  Off the design system
                </span>
                <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {audit[auditOpenFor]!.issues.slice(0, 6).map((iss, idx) => (
                    <li key={`${iss.kind}-${iss.line}-${iss.column}-${idx}`} style={{ fontSize: '0.63rem', color: 'var(--text-muted)' }}>
                      {iss.kind === 'hardcoded_color'
                        ? <>Colour <code style={{ color: 'var(--text)' }}>{iss.value}</code> written by hand</>
                        : <>Uses <code style={{ color: 'var(--text)' }}>{iss.value}</code>, which no style defines — it paints nothing</>}
                      <div style={{
                        marginTop: 1, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.58rem',
                        color: 'var(--text-muted)', opacity: 0.75,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{iss.snippet}</div>
                    </li>
                  ))}
                </ul>
                {(audit[auditOpenFor]!.issues.length > 6 || audit[auditOpenFor]!.truncated) && (
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                    …and {audit[auditOpenFor]!.truncated ? 'more' : audit[auditOpenFor]!.issues.length - 6} more
                  </span>
                )}
                {!readOnly && !preview && (
                  <button
                    onClick={() => { void handleFixBrand(auditOpenFor); }}
                    disabled={fixingPageId === auditOpenFor}
                    style={{ ...ghostBtn, justifyContent: 'center', fontSize: '0.68rem', padding: '4px 8px' }}
                  >
                    {fixingPageId === auditOpenFor
                      ? <><Loader2 size={11} className="spin" /> Fixing…</>
                      : <><Wand2 size={11} /> Fix it</>}
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Live progress placeholder while a new screen generates —
              reads the same design_page stream as the intro skeleton. */}
          {addingPage && (
            <div style={{
              margin: '4px 10px', padding: '8px 10px',
              border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)',
              display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text)', fontWeight: 600 }}>
                <Loader2 size={11} className="spin" style={{ color: 'var(--amber)' }} />
                {addingPageName ?? 'New screen'}
              </span>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                {(genStream?.text?.length ?? 0) > 0
                  ? `drawing… ${((genStream?.text?.length ?? 0) / 1000).toFixed(1)}k chars`
                  : (genStream?.reasoning?.length ?? 0) > 0 ? 'thinking…' : 'starting…'}
              </span>
            </div>
          )}
          {/* One-click suggestions from the concept (frontend phase). */}
          {screenSuggestions.length > 0 && !readOnly && (
            <div style={{ padding: '0 10px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>
                From your concept
              </span>
              {screenSuggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => { void addPageNamed(s); }}
                  disabled={addingPage}
                  style={{ ...ghostBtn, justifyContent: 'flex-start', fontSize: '0.68rem', padding: '4px 8px' }}
                >
                  <Plus size={10} /> {s}
                </button>
              ))}
            </div>
          )}
          {/* Inline add-screen mini-form (Enter = create, Esc = cancel). */}
          {!readOnly && (addFormOpen ? (
            <div style={{ margin: 10, display: 'flex', gap: 6 }}>
              <input
                autoFocus
                value={addFormName}
                onChange={(e) => setAddFormName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && addFormName.trim()) {
                    setAddFormOpen(false);
                    void addPageNamed(addFormName.trim());
                    setAddFormName('');
                  }
                  if (e.key === 'Escape') { setAddFormOpen(false); setAddFormName(''); }
                }}
                placeholder='e.g. "Pricing"'
                disabled={addingPage}
                style={{
                  flex: 1, minWidth: 0, padding: '5px 8px', fontSize: '0.72rem',
                  background: 'var(--surface)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-sans)', outline: 'none',
                }}
              />
              <button
                onClick={() => {
                  if (!addFormName.trim()) return;
                  setAddFormOpen(false);
                  void addPageNamed(addFormName.trim());
                  setAddFormName('');
                }}
                disabled={addingPage || !addFormName.trim()}
                style={{ ...ghostBtn, padding: '5px 8px' }}
              >
                Add
              </button>
            </div>
          ) : (
            <button onClick={() => setAddFormOpen(true)} disabled={addingPage} style={{ ...ghostBtn, margin: 10, justifyContent: 'center' }}>
              {addingPage ? <Loader2 size={12} className="spin" /> : <Plus size={12} />} Add screen
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {!readOnly && (
            <div style={{ padding: '8px 10px 0' }}>
              <TourStrip
                storageKey="claw-design-canvas-tour-seen"
                steps={[
                  'Click any element to select it — you can edit its text in place.',
                  'Type an instruction below to redesign the selection (or the whole screen).',
                  designChrome
                    ? 'Add screens as you go; when you like it, hit "Build it…".'
                    : 'Add screens as you go; when you like it, hit Approve.',
                ]}
              />
            </div>
          )}
          {/* Banda de previsualización: deja claro QUÉ se está viendo y que
              no se puede editar mientras tanto (el servidor siempre edita
              contra la versión actual — ver una y editar otra sería peor
              que el bug que esto arregla). */}
          {preview && activePage && (
            <div
              data-preview-bar
              style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                margin: '8px 10px 0', padding: '7px 12px',
                // El popover del historial se ancla arriba a la derecha y taparía
                // estos botones: se le reserva su hueco mientras esté abierto,
                // porque saltar de versión con el historial abierto es el uso normal.
                paddingRight: showHistory ? 300 : 12,
                border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
                fontSize: '0.74rem', color: 'var(--text)',
              }}
            >
              <Eye size={13} style={{ color: 'var(--amber)', flexShrink: 0 }} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '38%' }}>
                {compareCurrent
                  ? <>Comparing — showing the <strong>current</strong> version (v{activePage.version})</>
                  : <>Viewing <strong>v{preview.version}</strong>{preview.source === 'generate' ? ' — generated' : preview.instruction ? ` — ${preview.instruction}` : ''} · read-only</>}
              </span>
              {/* Acciones a la IZQUIERDA a propósito: el popover del historial
                  se ancla arriba a la derecha y taparía estos botones, y la
                  gracia es poder saltar de versión con el historial abierto. */}
              <button onClick={() => setCompareCurrent((c) => !c)} style={{ ...ghostBtn, padding: '3px 9px', fontSize: '0.7rem' }}>
                {compareCurrent ? `Back to v${preview.version}` : 'Compare with current'}
              </button>
              <button
                onClick={() => { void handleRevert(preview.version); }}
                style={{ ...ghostBtn, padding: '3px 9px', fontSize: '0.7rem' }}
              >
                <History size={11} /> Restore this version
              </button>
              <button onClick={exitPreview} style={{ ...primaryBtn(false), padding: '3px 10px', fontSize: '0.7rem' }}>
                Back to current
              </button>
              <div style={{ flex: 1 }} />
            </div>
          )}

          {/* Aviso de contenido perdido — nunca bloquea, siempre deshacible. */}
          {contentWarning && (
            <div
              data-content-warning
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                margin: '8px 10px 0', padding: '8px 12px',
                border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
                fontSize: '0.74rem', color: 'var(--text)',
              }}
            >
              <AlertTriangle size={13} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>
                  This edit dropped {contentWarning.lost} thing{contentWarning.lost === 1 ? '' : 's'} from
                  {' '}<strong>{contentWarning.pageName}</strong> — check it still says what you wanted.
                </div>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Missing: {contentWarning.missing.slice(0, 3).join(' · ')}{contentWarning.missing.length > 3 ? ' …' : ''}
                </div>
              </div>
              <button
                onClick={() => { const to = contentWarning.backTo; setContentWarning(null); void handleRevert(to); }}
                style={{ ...ghostBtn, padding: '3px 9px', fontSize: '0.7rem' }}
              >
                Undo
              </button>
              <button onClick={() => setContentWarning(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }} aria-label="Dismiss">
                <X size={13} />
              </button>
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0 }}>
          {activePage && (
            <DesignCanvas
              ref={canvasRef}
              pageHtml={preview && !compareCurrent ? preview.html : activePage.html}
              tokensCss={effectiveTokens}
              overridesCss={overridesCss}
              device={device}
              onSelect={readOnly || preview ? () => {} : (sel) => {
                setSelection(sel);
                // Se ancla AL CAPTURAR, no al enviar: si algo reescribe la
                // pantalla entretanto, el ancla deja de coincidir y el
                // servidor cae solo al camino completo.
                setSelectionBaseVersion(sel ? activePage.version : null);
              }}
              onTextEdited={readOnly || preview ? () => {} : handleTextEdited}
            />
          )}
          </div>

          {/* Brand knobs popover */}
          {showKnobs && (
            <div style={popover}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: '0.78rem', color: 'var(--text)' }}>Brand colors</strong>
                <button onClick={() => setShowKnobs(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}><X size={13} /></button>
              </div>
              {(['primary', 'accent', 'background'] as const).map((k) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 6 }}>
                  <input
                    type="color"
                    value={knobColors[k] ?? '#888888'}
                    onChange={(e) => setKnobColors((c) => ({ ...c, [k]: e.target.value }))}
                    style={{ width: 28, height: 22, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                  />
                  {k}
                  <code style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>{knobColors[k]}</code>
                </label>
              ))}
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '4px 0 8px' }}>
                Changes preview live on every page. Save rewrites the design tokens.
              </p>
              <button onClick={() => { void handleSaveKnobs(); }} disabled={busyAction === 'knobs'} style={{ ...primaryBtn(false), width: '100%', justifyContent: 'center' }}>
                {busyAction === 'knobs' ? <Loader2 size={12} className="spin" /> : <Check size={12} />} Save colors
              </button>
            </div>
          )}

          {/* History popover */}
          {showHistory && (
            <div style={popover}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: '0.78rem', color: 'var(--text)' }}>History — {activePage?.name}</strong>
                <button onClick={() => setShowHistory(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}><X size={13} /></button>
              </div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '0 0 6px' }}>
                Click a version to look at it — that doesn&apos;t change anything.
              </p>
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {versions.map((v) => {
                  const isCurrent = v.version === activePage?.version;
                  const isViewing = preview?.version === v.version;
                  const restoredFrom = /^revert to v(\d+)$/.exec(v.instruction ?? '')?.[1];
                  const label = v.source === 'generate' ? 'generated'
                    : v.source === 'edit_llm' ? (v.instruction ?? 'AI edit')
                      : v.source === 'edit_text' ? 'text edit'
                        : restoredFrom ? `restored from v${restoredFrom}` : (v.instruction ?? 'restored');
                  return (
                    <div
                      key={v.version}
                      role="button"
                      tabIndex={0}
                      data-version-row={v.version}
                      onClick={() => { void handlePreviewVersion(v.version); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handlePreviewVersion(v.version); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem',
                        color: 'var(--text-dim)', padding: '4px 6px', borderBottom: '1px solid var(--border)',
                        cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                        background: isViewing ? 'color-mix(in srgb, var(--amber) 10%, transparent)' : 'transparent',
                      }}
                    >
                      <strong style={{ color: 'var(--text)' }}>v{v.version}</strong>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                      {isCurrent && <span style={{ fontSize: '0.6rem', color: 'var(--amber)' }}>current</span>}
                      {isViewing && !isCurrent && <span style={{ fontSize: '0.6rem', color: 'var(--amber)' }}>viewing</span>}
                      {!isCurrent && (
                        <button
                          onClick={(e) => { e.stopPropagation(); void handleRevert(v.version); }}
                          style={{ ...ghostBtn, padding: '2px 8px', fontSize: '0.66rem' }}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  );
                })}
                {versions.length === 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Loading…</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instruction bar (hidden entirely in read-only surfaces) */}
      {!readOnly && (
      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--card)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {/* One-click iteration starters (both chromes — they orient a
            first-time user just as much on a pure design project). */}
        {!selection && !instruction && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CANVAS_SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => setInstruction(s)} disabled={editing} style={{ ...ghostBtn, borderRadius: 999, fontSize: '0.68rem', padding: '3px 10px' }}>
                {s}
              </button>
            ))}
          </div>
        )}
        {selection && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            <span style={{ padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--amber) 12%, transparent)', border: '1px solid var(--amber)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
              &lt;{selection.tag}&gt;
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>
              {selection.text || selection.path}
            </span>
            <button
              onClick={() => { if (selection) canvasRef.current?.requestTextEdit(selection.claw_id); }}
              style={ghostBtn}
              title="Edit the text directly on the canvas (no AI)"
            >
              <Type size={12} /> Edit text
            </button>
            <button
              onClick={dropSelection}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
              aria-label="Clear selection"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <textarea
            ref={instructionRef}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleEditWithAI(); } }}
            rows={1}
            disabled={editing || !!preview}
            placeholder={preview
              ? `You're looking at v${preview.version} — go back to the current version to make changes`
              : selection
              ? `Change the selected <${selection.tag}> — e.g. "make it bigger and use the accent color"`
                : 'Tell me what to change on this screen — or click any element to scope the change'}
            style={{ ...textArea, minHeight: 40, height: 40 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingBottom: 10 }}>
            <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} disabled={realPages.length < 2} />
            all pages
          </label>
          <button onClick={() => { void handleEditWithAI(); }} disabled={!instruction.trim() || editing || !!preview} style={primaryBtn(!instruction.trim() || editing || !!preview)}>
            {editing ? <><Loader2 size={13} className="spin" /> Applying…</> : <><Wand2 size={13} /> Apply <ArrowRight size={12} /></>}
          </button>
        </div>
      </div>
      )}
      {confirmDialog}
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────

const topBar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
  borderBottom: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0,
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
  fontSize: '0.72rem', fontWeight: 500, background: 'transparent', color: 'var(--text-dim)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

/** Does the design need a backend? UNA sola regla: la de `brief-intel`, que
 *  es el espejo del `needsBackend` del servidor. Esta función tenía su propia
 *  copia (`/^\s*yes/` sobre fn_data|fn_integrations) y ya contradecía a las
 *  otras dos: un API externo daba backend y una respuesta libre en fn_data
 *  («inventory items») no lo daba. */
function designNeedsBackend(project: StudioProject): boolean {
  return briefNeedsBackend(briefAnswers(project));
}

/** Segmented 1/3/5 control — how many directions to generate (Open Design uses 5). */
function DirectionToggle({ value, onChange, disabled }: { value: 1 | 3 | 5; onChange: (v: 1 | 3 | 5) => void; disabled?: boolean }) {
  return (
    <div title="How many design options to generate" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', padding: 2, background: 'var(--card)' }}>
      <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', padding: '0 6px' }}>Options</span>
      {([1, 3, 5] as const).map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            style={{
              width: 26, height: 24, borderRadius: 'var(--radius-full)', border: 'none',
              fontSize: '0.74rem', fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
              fontFamily: 'var(--font-sans)',
              background: active ? 'var(--amber)' : 'transparent',
              color: active ? '#000' : 'var(--text-dim)',
            }}
          >{n}</button>
        );
      })}
    </div>
  );
}
const primaryBtn = (off: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
  fontSize: '0.78rem', fontWeight: 600,
  background: off ? 'var(--surface)' : 'var(--amber)',
  color: off ? 'var(--text-muted)' : '#000',
  border: off ? '1px solid var(--border)' : 'none',
  borderRadius: 'var(--radius-md)', cursor: off ? 'not-allowed' : 'pointer',
  fontFamily: 'var(--font-sans)',
});
const chip = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', fontSize: '0.75rem', fontWeight: active ? 700 : 500,
  background: active ? 'color-mix(in srgb, var(--amber) 12%, transparent)' : 'var(--card)',
  color: active ? 'var(--text)' : 'var(--text-dim)',
  border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
  borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-sans)',
});
const textArea: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 64,
  padding: '9px 12px', fontSize: '0.85rem', lineHeight: 1.5,
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-sans)', outline: 'none',
};
const segmented: React.CSSProperties = {
  display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
};
const segBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 9px', display: 'inline-flex', alignItems: 'center',
  background: active ? 'var(--surface)' : 'transparent',
  color: active ? 'var(--text)' : 'var(--text-muted)',
  border: 'none', cursor: 'pointer',
});
const popover: React.CSSProperties = {
  position: 'absolute', top: 10, right: 10, zIndex: 20, width: 280,
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', padding: 12,
};
const exportItem: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 8px',
  borderRadius: 'var(--radius-sm)', textDecoration: 'none',
  color: 'var(--text)', fontSize: '0.78rem', fontFamily: 'var(--font-sans)',
  // <span> child = the explainer line
  // (kept subtle; the strong is the action)
};

export default DesignStudioPage;
