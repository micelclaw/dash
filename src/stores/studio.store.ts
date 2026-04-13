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

export type StudioProjectStatus =
  | 'scoping'
  | 'concept'
  | 'frontend'
  | 'foundation'
  | 'implementation'
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
  doc_concept: string | null;
  doc_frontend: string | null;
  doc_foundation: string | null;
  implementation_plan: Record<string, unknown> | null;
  generated_files: unknown[];
  test_results: Record<string, unknown> | null;
  package_path: string | null;
  package_version: string | null;
  package_size_bytes: number | null;
  credits_estimated: number | null;
  credits_consumed: number;
  pending_questions: StudioPendingQuestion[];
  user_comments: StudioUserComment[];
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

  // Phase 6: planner + sessions
  buildPlan: (projectId: string) => Promise<{ plan: StudioImplementationPlan }>;
  fetchSessions: (projectId: string) => Promise<{ plan: StudioImplementationPlan | null; sessions: StudioSessionRow[] }>;
  runSession: (projectId: string, sessionNumber: number) => Promise<{ files_generated: StudioGeneratedFile[]; route_count: number; test_results?: StudioTestResults | null }>;
  runTests: (projectId: string, sessionNumber: number) => Promise<StudioTestResults>;

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
}

export type StudioRewindTarget = 'scoping' | 'concept' | 'frontend' | 'foundation' | 'implementation';

export interface StudioTemplateMeta {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  app_level: 'L1' | 'L2' | 'L3';
  preset_scope: Record<string, unknown>;
  preset_answers: Record<string, string>;
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

export interface StudioPlannedSession {
  number: number;
  title: string;
  description: string;
  filesToCreate: string[];
}

export interface StudioImplementationPlan {
  totalSessions: number;
  sessions: StudioPlannedSession[];
}

export interface StudioGeneratedFile {
  path: string;
  content: string;
  session?: number;
  action?: 'create' | 'modify';
}

export interface StudioSessionRow {
  id: string;
  project_id: string;
  session_number: number;
  title: string;
  description: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  files_generated: StudioGeneratedFile[];
  test_results: StudioTestResults | null;
  retry_count: number;
  max_retries: number;
  error_log: string | null;
  tokens_input: number;
  tokens_output: number;
  credits_cost: number;
  model_used: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ApiEnvelope<T> {
  data: T;
  tier?: string;
}

export const useStudioStore = create<StudioState>()((set, get) => ({
  projects: [],
  loading: false,
  error: null,

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

  async generateConcept(projectId, answers) {
    const res = await api.post<ApiEnvelope<{ stream_id: string; tokens_used: number }>>(
      `/studio/projects/${projectId}/generate/concept`,
      answers ? { answers } : {},
    );
    return res.data;
  },

  async generateFrontend(projectId, answers) {
    const res = await api.post<ApiEnvelope<{ stream_id: string; tokens_used: number }>>(
      `/studio/projects/${projectId}/generate/frontend`,
      answers ? { answers } : {},
    );
    return res.data;
  },

  async generateFoundation(projectId, answers) {
    const res = await api.post<ApiEnvelope<{ stream_id: string; tokens_used: number }>>(
      `/studio/projects/${projectId}/generate/foundation`,
      answers ? { answers } : {},
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

  // ─── Phase 6: planner + sessions ─────────────────────────────────

  async buildPlan(projectId) {
    const res = await api.post<ApiEnvelope<{ plan: StudioImplementationPlan; tokens_used: number }>>(
      `/studio/projects/${projectId}/plan`,
      {},
    );
    return { plan: res.data.plan };
  },

  async fetchSessions(projectId) {
    const res = await api.get<ApiEnvelope<{ plan: StudioImplementationPlan | null; sessions: StudioSessionRow[] }>>(
      `/studio/projects/${projectId}/sessions`,
    );
    return res.data;
  },

  async runSession(projectId, sessionNumber) {
    const res = await api.post<ApiEnvelope<{
      session_number: number;
      files_generated: StudioGeneratedFile[];
      migration_applied: boolean;
      notes: string | null;
      tokens_used: number;
      route_count: number;
      test_results?: StudioTestResults | null;
    }>>(
      `/studio/projects/${projectId}/sessions/${sessionNumber}/run`,
      {},
    );
    return res.data;
  },

  async runTests(projectId, sessionNumber) {
    const res = await api.post<ApiEnvelope<StudioTestResults>>(
      `/studio/projects/${projectId}/sessions/${sessionNumber}/test`,
      {},
    );
    return res.data;
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
    return res.data;
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
}));
