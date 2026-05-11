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

// ─── Claw Studio store ──────────────────────────────────────────────
// Phase 1: project list + CRUD only. Phases 2-11 add scoping wizard,
// LLM streaming, sandbox state, sessions, packaging, etc.

import { create } from 'zustand';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

// Studio LLM-backed endpoints can take 30-180s. The dash's default
// fetch timeout (15s) would abort them mid-run, leaving the UI with
// stale state while the runner keeps working server-side. 10 minutes
// covers even the slowest implementation session with comfortable
// margin (auto-fix loop included).
const STUDIO_LONG_RUNNING_TIMEOUT_MS = 10 * 60 * 1000;

export type StudioProjectStatus =
  | 'scoping'
  | 'concept'
  | 'frontend'
  | 'foundation'
  | 'build'
  | 'testing'
  | 'packaging'
  | 'packaged'
  | 'published'
  | 'archived'
  | 'frozen';

export type AppLevel = 'L1' | 'L2' | 'L3';

export interface StudioPendingQuestion {
  id: string;
  question: string;
  options?: string[];
  /** When true the user can pick more than one of `options`. */
  multi?: boolean;
  allow_free_text?: boolean;
  rationale?: string;
}

export interface StudioUserComment {
  phase: string;
  comment: string;
  timestamp: string;
}

export interface StudioProject {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  status: StudioProjectStatus;
  app_level: AppLevel | null;
  scope: Record<string, unknown> & { needs_ui?: boolean };
  /** Raw answers from the scoping wizard. Pre-populated when the
   *  project was created from a template; the wizard hydrates from
   *  this map so the user can review/edit before submitting. */
  scoping_answers: Record<string, string>;
  /** Slug of the bundled template this project was instantiated from
   *  (null for blank projects). Used to look up template-specific
   *  placeholders for phase context textareas. */
  template_slug: string | null;
  doc_concept: string | null;
  doc_frontend: string | null;
  doc_foundation: string | null;
  /** Free-form prose the model wrote OUTSIDE the structured blocks
   *  on the latest doc-phase turn. Rendered above the question cards
   *  so a quick comment-box answer isn't silently dropped. */
  last_preamble: string | null;
  generated_files: unknown[];
  test_results: Record<string, unknown> | null;
  package_path: string | null;
  package_version: string | null;
  package_size_bytes: number | null;
  credits_estimated: number | null;
  credits_consumed: number;
  pending_questions: StudioPendingQuestion[];
  user_comments: StudioUserComment[];
  /** Absolute on-disk workspace dir. Set at project creation. */
  workspace_path: string | null;
  /** Build checklist; null until /build/start runs. */
  build_checklist: Array<{
    id: string;
    text: string;
    status: 'pending' | 'in_progress' | 'done';
    evidence?: 'auto' | 'agent' | 'manual';
    updated_at?: string;
  }> | null;
  build_token_cap: number;
  build_turn_cap: number;
  /** When true, every build turn is forced into plan-mode regardless of
   *  the OC session's current mode. The user must approve each plan
   *  before the agent executes. Toggleable from the build settings. */
  build_force_plan_mode: boolean;
  /** Per-project LLM model in `<provider>/<model>` form. Picked in the
   *  create wizard, applies to every phase (Concept / Frontend /
   *  Foundation / Build). */
  model: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  archived_at: string | null;
  frozen_at: string | null;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  icon?: string;
  /** `<provider>/<model>` identifier picked in the create wizard.
   *  Applies to every LLM call for this project. */
  model?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
}

// ─── Scoping (Phase 2) types ────────────────────────────────────────

export interface ScopingOption {
  id: string;
  icon?: string;
  label: string;
  description: string;
  updates_scope?: Record<string, unknown>;
}

export interface ScopingQuestion {
  id: string;
  battery: 1 | 2 | 3;
  branch?: string;
  title: string;
  description?: string;
  type: 'single';
  options: ScopingOption[];
}

export interface ScopingTree {
  battery1: ScopingQuestion;
  battery2: Record<string, ScopingQuestion[]>;
  battery3: ScopingQuestion[];
}

export interface ScopingClassification {
  scope: Record<string, unknown>;
  app_level: AppLevel;
  detected_components: string[];
  credits_estimate: number;
}

export type ScopingAnswers = Record<string, string>;

interface StudioState {
  projects: StudioProject[];
  loading: boolean;
  error: string | null;

  /** Bundled-template metadata cache. Populated lazily on first
   *  `fetchTemplates()` call; phase wrappers read from here to look up
   *  template-specific placeholders without an extra API roundtrip. */
  templates: StudioTemplateMeta[] | null;
  getTemplateBySlug: (slug: string | null | undefined) => StudioTemplateMeta | undefined;
  ensureTemplatesLoaded: () => Promise<StudioTemplateMeta[]>;

  fetchProjects: () => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<StudioProject>;
  updateProject: (id: string, input: UpdateProjectInput) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProject: (id: string) => StudioProject | undefined;

  // Scoping (Phase 2)
  fetchScopingTree: (projectId: string) => Promise<ScopingTree>;
  previewScoping: (projectId: string, answers: ScopingAnswers) => Promise<ScopingClassification>;
  submitScoping: (projectId: string, answers: ScopingAnswers) => Promise<ScopingClassification>;

  // Generation (Phase 3+)
  generateConcept: (projectId: string, answers?: Record<string, string>) => Promise<{ stream_id: string; tokens_used: number }>;
  generateFrontend: (projectId: string, answers?: Record<string, string>) => Promise<{ stream_id: string; tokens_used: number }>;
  generateFoundation: (projectId: string, answers?: Record<string, string>) => Promise<{ stream_id: string; tokens_used: number }>;
  approvePhase: (projectId: string, phase: 'concept' | 'frontend' | 'foundation', comment?: string) => Promise<{ status: string }>;
  cancelGeneration: (projectId: string, phase: string) => Promise<void>;
  refetchProject: (projectId: string) => Promise<StudioProject | null>;

  // Phase 8: preview pane
  fetchSandboxRoutes: (projectId: string) => Promise<StudioMountedRoute[]>;
  callSandbox: (projectId: string, method: string, path: string, body: unknown) => Promise<{ status: number; body: unknown; durationMs: number }>;

  // Phase 9: skill-test attach to a real agent
  fetchSkillTestAttached: (projectId: string) => Promise<string[]>;
  attachSkillTest: (projectId: string, agentName: string) => Promise<{ agent_name: string; fragment_size: number }>;
  detachSkillTest: (projectId: string, agentName: string) => Promise<{ removed: boolean }>;

  // Phase 10: packaging
  packageProject: (projectId: string) => Promise<StudioPackageResult>;
  installPackagedProject: (projectId: string) => Promise<{ installed: boolean; manifest_name: string }>;
  packageDownloadUrl: (projectId: string) => string;

  // Phase 11: templates + activity
  fetchTemplates: () => Promise<StudioTemplateMeta[]>;
  instantiateTemplate: (slug: string, name?: string) => Promise<StudioProject>;
  fetchActivity: () => Promise<StudioActivityReport>;

  // Rewind: roll back to an earlier phase, cascade-clearing downstream
  rewindProject: (projectId: string, target: StudioRewindTarget) => Promise<{ project: StudioProject; cleared: string[] }>;

  // Phase 7: Testing — Studio Tester chat + auto tests + transitions
  fetchTestMessages: (projectId: string) => Promise<StudioTestMessage[]>;
  sendTestMessage: (projectId: string, message: string) => Promise<{ message_id: string; assistant_content: string }>;
  runAutoTestsForProject: (projectId: string) => Promise<StudioTestResults>;
  advanceToTesting: (projectId: string) => Promise<void>;
  backToBuild: (projectId: string) => Promise<void>;
  signOffTesting: (projectId: string) => Promise<void>;

  // ─── Build phase (OpenCode-backed) ───────────────────────────────
  startBuild: (projectId: string) => Promise<StudioBuildStartResult>;
  sendBuildMessage: (projectId: string, message: string) => Promise<{ opencode_session_id: string }>;
  abortBuild: (projectId: string) => Promise<{ aborted: boolean }>;
  finishBuild: (projectId: string, force?: boolean) => Promise<{ transitioned_to: 'testing'; checklist_done: number; checklist_total: number }>;
  fetchBuildSettings: (projectId: string) => Promise<StudioBuildSettings>;
  saveBuildSettings: (projectId: string, settings: StudioBuildSettingsInput) => Promise<StudioBuildSettings>;
  fetchBuildChecklist: (projectId: string) => Promise<StudioChecklistItem[]>;
  patchChecklistItem: (projectId: string, itemId: string, status: StudioChecklistStatus) => Promise<StudioChecklistItem>;
  fetchWorkspaceFiles: (projectId: string) => Promise<StudioWorkspaceFile[]>;
  fetchWorkspaceFile: (projectId: string, path: string) => Promise<StudioWorkspaceFileContent>;
  fetchBuildMessages: (projectId: string) => Promise<StudioBuildMessageRow[]>;
  fetchBuildRecentEvents: (projectId: string, sinceSeq: number) => Promise<StudioBuildRecentEvents>;
  /** Mode hydration on mount — used by useOpencodeStream so the badge
   *  + plan-approval banner render correctly without waiting for a WS
   *  event after a refresh. */
  fetchBuildState: (projectId: string) => Promise<StudioBuildState>;
  /** Flip a plan-mode session to build-mode after the user approves
   *  the plan + checklist the agent emitted. */
  approveBuildPlan: (projectId: string) => Promise<{ opencode_session_id: string; mode: 'build' }>;
  /** Inverse: flip a build-mode session back to plan-mode (no auto
   *  prompt — the next message goes via `agent: 'plan'`). Used when
   *  the user wants to extend/revise the plan without aborting. */
  revertBuildToPlan: (projectId: string) => Promise<{ opencode_session_id: string; mode: 'plan' }>;
  /** Persist the project-level "force plan mode" toggle. */
  setForcePlanMode: (projectId: string, enabled: boolean) => Promise<void>;
  /** Preview of the plan-mode prompt that POST /build/start will send
   *  to the agent. Used by the dash to render an empty-state preview
   *  in the chat before the user clicks Start. */
  fetchBuildWelcomePreview: (projectId: string) => Promise<StudioBuildWelcomePreview>;
}

export interface StudioBuildWelcomePreview {
  prompt: string;
  mode: 'plan';
  workspace_path: string;
}

// ─── Studio v2 wire types ─────────────────────────────────────────

export type StudioOpencodeMode = 'plan' | 'build';

export interface StudioBuildStartResult {
  opencode_session_id: string;
  workspace_path: string;
  build_checklist: Array<{ id: string; text: string; status: 'pending' | 'in_progress' | 'done'; evidence?: string }>;
  /** 'plan' on a fresh build session; flips to 'build' after the user
   *  approves the plan via `approveBuildPlan`. Existing pre-mode
   *  sessions report 'build' (default). */
  mode: StudioOpencodeMode;
  token_cap: number;
  turn_cap: number;
}

export interface StudioBuildState {
  mode: StudioOpencodeMode | null;
  status: string | null;
  opencode_session_id: string | null;
  force_plan_mode: boolean;
}

export interface StudioBuildSettings {
  /** Project-wide model. Set at creation; not editable from BuildPhase. */
  model: string | null;
  build_token_cap: number;
  build_turn_cap: number;
  build_force_plan_mode: boolean;
}

/** Caps + force-plan-mode toggle. Model is set at creation and is
 *  project-wide. */
export type StudioBuildSettingsInput = Partial<Pick<
  StudioBuildSettings,
  'build_token_cap' | 'build_turn_cap' | 'build_force_plan_mode'
>>;

export type StudioChecklistStatus = 'pending' | 'in_progress' | 'done';
export type StudioChecklistEvidence = 'auto' | 'agent' | 'manual';
export interface StudioChecklistItem {
  id: string;
  text: string;
  status: StudioChecklistStatus;
  evidence?: StudioChecklistEvidence;
  updated_at?: string;
}

export interface StudioWorkspaceFile {
  path: string;
  size: number;
  mtime: string;
}

export interface StudioWorkspaceFileContent {
  path: string;
  content: string;
  size: number;
  mtime: string;
}

export interface StudioBuildMessageRow {
  id: string;
  opencode_message_id: string;
  opencode_session_id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  parts: unknown[];
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string;
}

export interface StudioBuildRecentEvent {
  seq: number;
  event: string;
  data: Record<string, unknown>;
  ts: number;
}

export interface StudioBuildRecentEvents {
  events: StudioBuildRecentEvent[];
  current_seq: number;
  truncated: boolean;
}

export interface StudioTestMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls: unknown;
  created_at: string;
}

export type StudioRewindTarget = 'scoping' | 'concept' | 'frontend' | 'foundation';

export interface StudioTemplatePlaceholders {
  concept?: string;
  frontend?: string;
  foundation?: string;
}

export interface StudioTemplateMeta {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  app_level: 'L1' | 'L2' | 'L3';
  preset_scope: Record<string, unknown>;
  preset_answers: Record<string, string>;
  placeholders?: StudioTemplatePlaceholders;
}

export interface StudioActivityReport {
  grand_totals: { tokens: number; cost_usd: number; llm_calls: number };
  per_phase: Array<{ phase: string; tokens: number; cost_usd: number; calls: number }>;
  per_project: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    app_level: string | null;
    tokens_consumed: number;
    credits_estimated: number | null;
    last_activity_at: string;
  }>;
}

export interface StudioScanIssue {
  code: string;
  message: string;
  detail?: string;
}

export interface StudioScanResult {
  passed: boolean;
  level: 'L1' | 'L2' | 'L3';
  errors: StudioScanIssue[];
  warnings: StudioScanIssue[];
  scanned_at: string;
}

export interface StudioPackageResult {
  package_path: string;
  package_version: string;
  package_size_bytes: number;
  manifest_name: string;
  scan_result: StudioScanResult;
}

export interface StudioMountedRoute {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  pattern: string;
  param_names: string[];
}

export interface StudioTestCase {
  name: string;
  status: 'passed' | 'failed';
  error?: string;
  duration_ms?: number;
}

export interface StudioTestResults {
  passed: number;
  failed: number;
  total: number;
  duration_ms: number;
  tests: StudioTestCase[];
  stderr: string | null;
  exit_code: number;
}

export interface StudioGeneratedFile {
  path: string;
  content: string;
  action?: 'create' | 'modify';
}

interface ApiEnvelope<T> {
  data: T;
  tier?: string;
}

export const useStudioStore = create<StudioState>()((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  templates: null,

  getTemplateBySlug(slug) {
    if (!slug) return undefined;
    return get().templates?.find((t) => t.slug === slug);
  },

  async ensureTemplatesLoaded() {
    const cached = get().templates;
    if (cached) return cached;
    return get().fetchTemplates();
  },

  async fetchProjects() {
    set({ loading: true, error: null });
    try {
      const res = await api.get<ApiEnvelope<StudioProject[]>>('/studio/projects');
      set({ projects: res.data ?? [], loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Studio projects';
      set({ error: message, loading: false });
    }
  },

  async createProject(input) {
    const res = await api.post<ApiEnvelope<StudioProject>>('/studio/projects', input);
    const created = res.data;
    set((state) => ({ projects: [created, ...state.projects] }));
    return created;
  },

  async updateProject(id, input) {
    const res = await api.patch<ApiEnvelope<StudioProject>>(`/studio/projects/${id}`, input);
    const updated = res.data;
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? updated : p)),
    }));
  },

  async deleteProject(id) {
    await api.delete(`/studio/projects/${id}`);
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
  },

  getProject(id) {
    return get().projects.find((p) => p.id === id);
  },

  // ─── Scoping (Phase 2) ────────────────────────────────────────────

  async fetchScopingTree(projectId) {
    const res = await api.get<ApiEnvelope<ScopingTree>>(
      `/studio/projects/${projectId}/scoping/questions`,
    );
    return res.data;
  },

  async previewScoping(projectId, answers) {
    const res = await api.post<ApiEnvelope<ScopingClassification>>(
      `/studio/projects/${projectId}/scoping/preview`,
      { answers },
    );
    return res.data;
  },

  async submitScoping(projectId, answers) {
    const res = await api.post<ApiEnvelope<{
      project: StudioProject;
      app_level: AppLevel;
      detected_components: string[];
      credits_estimate: number;
      scope?: Record<string, unknown>;
    }>>(
      `/studio/projects/${projectId}/scoping/answers`,
      { answers },
    );
    const { project, app_level, detected_components, credits_estimate } = res.data;
    set((state) => ({
      projects: state.projects.map((p) => (p.id === projectId ? project : p)),
    }));
    return {
      scope: project.scope,
      app_level,
      detected_components,
      credits_estimate,
    };
  },

  // ─── Generation (Phase 3+) ────────────────────────────────────────
  //
  // Studio LLM calls are long-running: a single doc-phase generation
  // can take 30-180s (model thinking + token streaming + DB writes).
  // The dash's default 15s fetch timeout would abort the POST mid-run,
  // leaving the dash with stale state while the runner keeps working.
  // We use a 10-minute timeout for every Studio endpoint that triggers
  // an LLM call so the await holds until the runner truly finishes.

  async generateConcept(projectId, answers) {
    const res = await api.post<ApiEnvelope<{ stream_id: string; tokens_used: number }>>(
      `/studio/projects/${projectId}/generate/concept`,
      answers ? { answers } : {},
      { timeout: STUDIO_LONG_RUNNING_TIMEOUT_MS },
    );
    return res.data;
  },

  async generateFrontend(projectId, answers) {
    const res = await api.post<ApiEnvelope<{ stream_id: string; tokens_used: number }>>(
      `/studio/projects/${projectId}/generate/frontend`,
      answers ? { answers } : {},
      { timeout: STUDIO_LONG_RUNNING_TIMEOUT_MS },
    );
    return res.data;
  },

  async generateFoundation(projectId, answers) {
    const res = await api.post<ApiEnvelope<{ stream_id: string; tokens_used: number }>>(
      `/studio/projects/${projectId}/generate/foundation`,
      answers ? { answers } : {},
      { timeout: STUDIO_LONG_RUNNING_TIMEOUT_MS },
    );
    return res.data;
  },

  async approvePhase(projectId, phase, comment) {
    const res = await api.post<ApiEnvelope<{ status: string }>>(
      `/studio/projects/${projectId}/approve/${phase}`,
      comment ? { comment } : {},
    );
    return res.data;
  },

  async cancelGeneration(projectId, phase) {
    await api.post(`/studio/projects/${projectId}/generate/${phase}/cancel`, {});
  },

  async refetchProject(projectId) {
    const res = await api.get<ApiEnvelope<StudioProject>>(`/studio/projects/${projectId}`);
    const p = res.data;
    set((state) => {
      const exists = state.projects.find((x) => x.id === projectId);
      return {
        projects: exists
          ? state.projects.map((x) => (x.id === projectId ? p : x))
          : [p, ...state.projects],
      };
    });
    return p;
  },

  // ─── Phase 8: preview pane ──────────────────────────────────────

  async fetchSandboxRoutes(projectId) {
    const res = await api.get<ApiEnvelope<StudioMountedRoute[]>>(
      `/studio/projects/${projectId}/sandbox/routes`,
    );
    return res.data;
  },

  async fetchTemplates() {
    const res = await api.get<ApiEnvelope<StudioTemplateMeta[]>>('/studio/templates');
    const list = res.data ?? [];
    set({ templates: list });
    return list;
  },

  async instantiateTemplate(slug, name) {
    const res = await api.post<ApiEnvelope<StudioProject>>(
      `/studio/templates/${slug}/instantiate`,
      name ? { name } : {},
    );
    set((state) => ({ projects: [res.data, ...state.projects] }));
    return res.data;
  },

  async fetchActivity() {
    const res = await api.get<ApiEnvelope<StudioActivityReport>>('/studio/activity');
    return res.data;
  },

  async rewindProject(projectId, target) {
    const res = await api.post<ApiEnvelope<{ project: StudioProject; cleared: string[] }>>(
      `/studio/projects/${projectId}/rewind`,
      { to: target },
    );
    // Replace the project in the local store so any subscriber re-renders
    // immediately with the rewound state.
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? res.data.project : p,
      ),
    }));
    return res.data;
  },

  async packageProject(projectId) {
    const res = await api.post<ApiEnvelope<StudioPackageResult>>(
      `/studio/projects/${projectId}/package`,
      {},
    );
    return res.data;
  },

  async installPackagedProject(projectId) {
    const res = await api.post<ApiEnvelope<{ installed: boolean; manifest_name: string }>>(
      `/studio/projects/${projectId}/install`,
      {},
    );
    return res.data;
  },

  packageDownloadUrl(projectId) {
    return `/api/v1/studio/projects/${projectId}/package/download`;
  },

  async fetchSkillTestAttached(projectId) {
    const res = await api.get<ApiEnvelope<{ agents: string[] }>>(
      `/studio/projects/${projectId}/skill-test/attached`,
    );
    return res.data.agents;
  },

  async attachSkillTest(projectId, agentName) {
    const res = await api.post<ApiEnvelope<{ agent_name: string; fragment_size: number; workspace_path: string }>>(
      `/studio/projects/${projectId}/skill-test/attach`,
      { agent_name: agentName },
    );
    return { agent_name: res.data.agent_name, fragment_size: res.data.fragment_size };
  },

  async detachSkillTest(projectId, agentName) {
    const res = await api.post<ApiEnvelope<{ removed: boolean }>>(
      `/studio/projects/${projectId}/skill-test/detach`,
      { agent_name: agentName },
    );
    return res.data;
  },

  async callSandbox(projectId, method, path, body) {
    const startedAt = performance.now();
    // Strip a leading slash so we can join cleanly
    const cleanPath = path.replace(/^\/+/, '');
    const url = `/studio/projects/${projectId}/sandbox/api/${cleanPath}`;
    const opts: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (method !== 'GET' && method !== 'DELETE' && body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    // Use raw fetch — sandbox responses bypass the case-transform
    // plugin and may carry arbitrary shapes.
    const token = useAuthStore.getState().tokens?.accessToken ?? null;
    const res = await fetch(`/api/v1${url}`, {
      ...opts,
      headers: {
        ...opts.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const durationMs = Math.round(performance.now() - startedAt);
    let parsed: unknown;
    const text = await res.text();
    try { parsed = text ? JSON.parse(text) : null; }
    catch { parsed = text; }
    return { status: res.status, body: parsed, durationMs };
  },

  // ─── Phase 7: Testing ──────────────────────────────────────
  async fetchTestMessages(projectId) {
    const res = await api.get<ApiEnvelope<{ messages: StudioTestMessage[] }>>(
      `/studio/projects/${projectId}/test/messages`,
    );
    return res.data.messages;
  },

  async sendTestMessage(projectId, message) {
    const res = await api.post<ApiEnvelope<{ message_id: string; assistant_content: string; tokens_used: number }>>(
      `/studio/projects/${projectId}/test/messages`,
      { message },
      // 10 min timeout — same generous window as runSession; the
      // model can take a while to think for complex test diagnoses.
      { timeout: 10 * 60 * 1000 },
    );
    return { message_id: res.data.message_id, assistant_content: res.data.assistant_content };
  },

  async runAutoTestsForProject(projectId) {
    const res = await api.post<ApiEnvelope<StudioTestResults>>(
      `/studio/projects/${projectId}/test/run-auto`,
      {},
      // Tests can take a few minutes; same envelope as runSession.
      { timeout: 10 * 60 * 1000 },
    );
    return res.data;
  },

  async advanceToTesting(projectId) {
    await api.post<ApiEnvelope<{ status: string }>>(
      `/studio/projects/${projectId}/advance-to-testing`,
      {},
    );
    // Refetch so UI sees the new status without a full page reload.
    const res = await api.get<ApiEnvelope<StudioProject>>(`/studio/projects/${projectId}`);
    set((state) => ({
      projects: state.projects.map((p) => p.id === projectId ? res.data : p),
    }));
  },

  async backToBuild(projectId) {
    await api.post<ApiEnvelope<{ status: string }>>(
      `/studio/projects/${projectId}/back-to-build`,
      {},
    );
    const res = await api.get<ApiEnvelope<StudioProject>>(`/studio/projects/${projectId}`);
    set((state) => ({
      projects: state.projects.map((p) => p.id === projectId ? res.data : p),
    }));
  },

  async signOffTesting(projectId) {
    await api.post<ApiEnvelope<{ status: string }>>(
      `/studio/projects/${projectId}/sign-off-testing`,
      {},
    );
    const res = await api.get<ApiEnvelope<StudioProject>>(`/studio/projects/${projectId}`);
    set((state) => ({
      projects: state.projects.map((p) => p.id === projectId ? res.data : p),
    }));
  },

  // ─── Build (OpenCode-backed) actions ───────────────────────────

  async startBuild(projectId) {
    const res = await api.post<ApiEnvelope<StudioBuildStartResult>>(
      `/studio/projects/${projectId}/build/start`,
      {},
      { timeout: STUDIO_LONG_RUNNING_TIMEOUT_MS },
    );
    return res.data;
  },

  async sendBuildMessage(projectId, message) {
    const res = await api.post<ApiEnvelope<{ opencode_session_id: string }>>(
      `/studio/projects/${projectId}/build/messages`,
      { message },
    );
    return res.data;
  },

  async abortBuild(projectId) {
    const res = await api.post<ApiEnvelope<{ aborted: boolean }>>(
      `/studio/projects/${projectId}/build/abort`,
      {},
    );
    return res.data;
  },

  async finishBuild(projectId, force = false) {
    const res = await api.post<ApiEnvelope<{ transitioned_to: 'testing'; checklist_done: number; checklist_total: number }>>(
      `/studio/projects/${projectId}/build/finish`,
      { force },
    );
    // Refresh the project locally so the UI sees status='testing'.
    await get().refetchProject(projectId);
    return res.data;
  },

  async fetchBuildSettings(projectId) {
    // Settings live on the project row itself; fetch it and pluck.
    // The model is project-wide (set in the create wizard) but exposed
    // here read-only for the BuildPhase settings popover.
    const res = await api.get<ApiEnvelope<StudioProject>>(`/studio/projects/${projectId}`);
    const p = res.data;
    return {
      model: p.model ?? null,
      build_token_cap: p.build_token_cap,
      build_turn_cap: p.build_turn_cap,
      build_force_plan_mode: p.build_force_plan_mode,
    };
  },

  async saveBuildSettings(projectId, settings) {
    const res = await api.patch<ApiEnvelope<StudioBuildSettings>>(
      `/studio/projects/${projectId}/build/settings`,
      settings,
    );
    return res.data;
  },

  async fetchBuildChecklist(projectId) {
    const res = await api.get<ApiEnvelope<{ items: StudioChecklistItem[] }>>(
      `/studio/projects/${projectId}/build/checklist`,
    );
    return res.data?.items ?? [];
  },

  async patchChecklistItem(projectId, itemId, status) {
    const res = await api.patch<ApiEnvelope<{ item: StudioChecklistItem }>>(
      `/studio/projects/${projectId}/build/checklist/${itemId}`,
      { status },
    );
    return res.data.item;
  },

  async fetchWorkspaceFiles(projectId) {
    const res = await api.get<ApiEnvelope<{ files: StudioWorkspaceFile[]; total_size_bytes: number }>>(
      `/studio/projects/${projectId}/workspace/files`,
    );
    return res.data.files ?? [];
  },

  async fetchWorkspaceFile(projectId, path) {
    const res = await api.get<ApiEnvelope<StudioWorkspaceFileContent>>(
      `/studio/projects/${projectId}/workspace/file`,
      { path },
    );
    return res.data;
  },

  async fetchBuildMessages(projectId) {
    const res = await api.get<ApiEnvelope<{ messages: StudioBuildMessageRow[] }>>(
      `/studio/projects/${projectId}/build/messages`,
    );
    return res.data.messages ?? [];
  },

  async fetchBuildState(projectId) {
    const res = await api.get<ApiEnvelope<StudioBuildState>>(
      `/studio/projects/${projectId}/build/state`,
    );
    return res.data;
  },

  async approveBuildPlan(projectId) {
    const res = await api.post<ApiEnvelope<{ opencode_session_id: string; mode: 'build' }>>(
      `/studio/projects/${projectId}/build/approve-plan`,
      {},
    );
    return res.data;
  },

  async revertBuildToPlan(projectId) {
    const res = await api.post<ApiEnvelope<{ opencode_session_id: string; mode: 'plan' }>>(
      `/studio/projects/${projectId}/build/revert-to-plan`,
      {},
    );
    return res.data;
  },

  async fetchBuildWelcomePreview(projectId) {
    const res = await api.get<ApiEnvelope<StudioBuildWelcomePreview>>(
      `/studio/projects/${projectId}/build/welcome-preview`,
    );
    return res.data;
  },

  async setForcePlanMode(projectId, enabled) {
    await api.patch<ApiEnvelope<StudioBuildSettings>>(
      `/studio/projects/${projectId}/build/settings`,
      { build_force_plan_mode: enabled },
    );
    // Reflect locally so the Settings UI doesn't have to round-trip a
    // refetchProject just to flip a checkbox.
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, build_force_plan_mode: enabled } : p,
      ),
    }));
  },

  async fetchBuildRecentEvents(projectId, sinceSeq) {
    const res = await api.get<ApiEnvelope<StudioBuildRecentEvents>>(
      `/studio/projects/${projectId}/build/recent-events`,
      { since: sinceSeq },
    );
    return res.data;
  },
}));
