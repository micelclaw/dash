import { api } from './api';

export type SlackMeetingMode = 'transcribe' | 'agent' | 'bidi';
export interface SlackMeeting {
  id: string; user_id: string; conversation_id: string | null; huddle_url: string | null;
  mode: SlackMeetingMode; status: 'reserved' | 'connecting' | 'active' | 'cleanup_pending' | 'closed';
  failure_code: string | null; created_at: string; updated_at: string;
}
export interface SlackMeetingCapabilities {
  prepared: boolean; reason: string | null; can_prepare: boolean; account_busy: boolean;
  modes: SlackMeetingMode[]; memory_between_meetings: false; workshop_eligible: false;
}
export interface SlackNativeStatus {
  found: boolean;
  session?: { id: string; state: string; chrome?: { health?: {
    in_call?: boolean; mic_muted?: boolean; captioning?: boolean; speech_ready?: boolean; audio_output_active?: boolean; manual_action?: { reason: string };
  } } };
}
export const getSlackMeetingCapabilities = async (signal?: AbortSignal) =>
  (await api.get<{ data: SlackMeetingCapabilities }>('/slack-meetings/capabilities', undefined, { signal })).data;
export const listSlackMeetings = async (signal?: AbortSignal) =>
  (await api.get<{ data: SlackMeeting[] }>('/slack-meetings', undefined, { signal })).data;
export const prepareSlackMeetings = async () =>
  (await api.post<{ data: SlackMeetingCapabilities }>('/slack-meetings/prepare')).data;
export const joinSlackMeeting = async (body: { operation_id: string; conversation_id: string; huddle_url: string; mode: SlackMeetingMode; capture_acknowledged: boolean }) =>
  (await api.post<{ data: SlackMeeting }>('/slack-meetings', body, { timeout: 180_000 })).data;
export const leaveSlackMeeting = async (id: string) =>
  (await api.post<{ data: { closed: boolean } }>(`/slack-meetings/${encodeURIComponent(id)}/leave`, undefined, { timeout: 90_000 })).data;
export const getSlackMeetingStatus = async (id: string, signal?: AbortSignal) =>
  (await api.get<{ data: { meeting: SlackMeeting; native: SlackNativeStatus | null } }>(`/slack-meetings/${encodeURIComponent(id)}`, undefined, { signal })).data;
export const getSlackMeetingTranscript = async (id: string) =>
  (await api.get<{ data: { found: true; session_id: string; start_index: number; next_index: number; dropped_lines: number; evicted?: boolean; lines: { text: string; speaker?: string; timestamp?: string }[] } }>(`/slack-meetings/${encodeURIComponent(id)}/transcript`)).data;
export const probeSlackMeeting = async (body: { operation_id: string; kind: 'setup' | 'testListen' | 'testSpeech'; huddle_url?: string; mode: SlackMeetingMode }) =>
  (await api.post<{ data: { result: { listen_verified: boolean | null; speech_output_verified: boolean | null; spoken: boolean | null; external_participant_confirmed: false } | null } }>('/slack-meetings/probe', body, { timeout: 180_000 })).data;
