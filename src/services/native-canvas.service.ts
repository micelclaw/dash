import { api } from './api';

export interface NativeCanvasBoard { revision?: number; tabs?: unknown[]; widgets?: unknown[]; can_manage?: boolean; can_edit?: boolean; [key: string]: unknown }
export interface NativeCanvasActivity { id: string; action: string; widget_name?: string | null; board_revision?: string | null; created_at: string; metadata: Record<string, unknown>; actor?: { id: string; display_name: string; avatar_url?: string | null } | null }
export interface NativeCanvasDocument { html: string; sandbox_url: string; sandbox_port: number; sandbox_origin?: string }
export interface NativeCanvasExport { file: { file_id: string; filename: string; mime: string }; static: true }
export interface NativeCanvasWidgetView { frameId: string; expiresAt: string; url: string }
export interface NativeCanvasStatus { native_canvas_enabled: boolean; native_canvas_activity_enabled: boolean }
export interface NativeCanvasMember { user_id: string; permission: 'view' | 'edit'; created_at: string }
export interface NativeCanvasGalleryItem { conversation_id: string; title: string; shared: boolean; updated_at: string }
export type NativeCanvasBridgeCommand =
  | { kind: 'state'; payload: Record<string, unknown> }
  | { kind: 'data'; binding_id: string; params?: Record<string, unknown> }
  | { kind: 'action'; action: string; params?: Record<string, unknown> }
  | { kind: 'cron'; job_id: string };

export const nativeCanvasService = {
  async status(): Promise<NativeCanvasStatus> {
    const response = await api.get<{ data: NativeCanvasStatus }>('/canvas/status');
    return response.data;
  },
  async gallery(): Promise<NativeCanvasGalleryItem[]> {
    const response = await api.get<{ data: { items: NativeCanvasGalleryItem[] } }>('/canvas/gallery');
    return response.data.items;
  },
  async members(conversationId: string): Promise<NativeCanvasMember[]> {
    const response = await api.get<{ data: { members: NativeCanvasMember[] } }>(`/conversations/${encodeURIComponent(conversationId)}/canvas/members`);
    return response.data.members;
  },
  async addMember(conversationId: string, userId: string, permission: 'view' | 'edit' = 'view'): Promise<void> {
    await api.post(`/conversations/${encodeURIComponent(conversationId)}/canvas/members`, { user_id: userId, permission });
  },
  async updateMemberPermission(conversationId: string, userId: string, permission: 'view' | 'edit'): Promise<void> {
    await api.patch(`/conversations/${encodeURIComponent(conversationId)}/canvas/members/${encodeURIComponent(userId)}`, { permission });
  },
  async removeMember(conversationId: string, userId: string): Promise<void> {
    await api.delete(`/conversations/${encodeURIComponent(conversationId)}/canvas/members/${encodeURIComponent(userId)}`);
  },
  async board(conversationId: string): Promise<NativeCanvasBoard> {
    const response = await api.get<{ data: { board: NativeCanvasBoard; can_manage?: boolean; can_edit?: boolean } }>(`/conversations/${encodeURIComponent(conversationId)}/canvas/board`);
    return { ...response.data.board, can_manage: response.data.can_manage === true, can_edit: response.data.can_edit === true };
  },
  async activity(conversationId: string, before?: string): Promise<NativeCanvasActivity[]> {
    const response = await api.get<{ data: { activity: NativeCanvasActivity[] } }>(`/conversations/${encodeURIComponent(conversationId)}/canvas/activity`, { before });
    return response.data.activity;
  },
  async document(conversationId: string, documentId: string): Promise<NativeCanvasDocument> {
    const response = await api.get<{ data: { document: NativeCanvasDocument } }>(`/conversations/${encodeURIComponent(conversationId)}/canvas/documents/${encodeURIComponent(documentId)}`);
    return response.data.document;
  },
  async createWidgetView(conversationId: string, name: string): Promise<NativeCanvasWidgetView> {
    const base = `/conversations/${encodeURIComponent(conversationId)}/canvas/widgets/${encodeURIComponent(name)}/view`;
    const response = await api.post<{ data: { frame_id: string; expires_at: string } }>(base, {});
    const frameId = response.data.frame_id;
    return { frameId, expiresAt: response.data.expires_at, url: api.frameUrl(`${base}?frame_id=${encodeURIComponent(frameId)}`) };
  },
  async widgetHtml(conversationId: string, name: string, frameId: string): Promise<string> {
    // A sandboxed iframe has an opaque origin and cannot attach a Bearer
    // header. Fetch in the authenticated Dash parent; the frame receives only
    // the already-authorized HTML, never the user's token or Gateway ticket.
    return api.getText(`/conversations/${encodeURIComponent(conversationId)}/canvas/widgets/${encodeURIComponent(name)}/view`, { frame_id: frameId });
  },
  async bridgeWidget(conversationId: string, name: string, frameId: string, command: NativeCanvasBridgeCommand): Promise<unknown> {
    const response = await api.post<{ data: { result: unknown } }>(`/conversations/${encodeURIComponent(conversationId)}/canvas/widgets/${encodeURIComponent(name)}/bridge`, {
      frame_id: frameId,
      ...command,
    });
    return response.data.result;
  },
  async exportDocument(conversationId: string, documentId: string, input: { format: 'html' | 'json' | 'pdf' | 'png' | 'svg' | 'report'; title?: string | null }): Promise<NativeCanvasExport> {
    const response = await api.post<{ data: NativeCanvasExport }>(`/conversations/${encodeURIComponent(conversationId)}/canvas/documents/${encodeURIComponent(documentId)}/export`, input);
    return response.data;
  },
  async ensurePdfRenderer(): Promise<void> {
    const current = await api.get<{ data: { stirling_pdf: { running: boolean } } }>('/office/status');
    if (current.data.stirling_pdf.running) return;
    await api.post('/office/start/stirling-pdf', undefined, { timeout: 60_000 });

    // The lifecycle endpoint acknowledges the start request before the
    // container is ready to accept conversions. Match the Office module's
    // polling behavior instead of treating that acknowledgement as readiness.
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      const status = await api.get<{ data: { stirling_pdf: { running: boolean; url?: string } } }>('/office/status');
      if (status.data.stirling_pdf.running && status.data.stirling_pdf.url) return;
    }

    throw new Error('Stirling PDF no quedó listo. Revisa el servicio en Office e inténtalo de nuevo.');
  },
  async updateBoard(conversationId: string, expectedRevision: number, ops: Array<Record<string, unknown>>): Promise<NativeCanvasBoard> {
    const response = await api.patch<{ data: { board: NativeCanvasBoard } }>(`/conversations/${encodeURIComponent(conversationId)}/canvas/board`, {
      expected_revision: expectedRevision,
      ops,
    });
    return response.data.board;
  },
};
