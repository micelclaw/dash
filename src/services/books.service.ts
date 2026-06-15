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

/**
 * Books service — thin wrapper over the Core books API (`/api/v1/books/*`).
 * Two halves:
 *  - READER: disk-based EPUB library (progress + annotations in Postgres).
 *  - AUDIOBOOKS: Audiobookshelf proxy. May be absent — endpoints degrade to
 *    503 `ABS_UNAVAILABLE` which the store maps to a friendly empty state.
 *
 * All responses are snake_case on the wire (case-transform plugin in Core).
 */

import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// ─── Wire types (snake_case) ─────────────────────────────

export interface BooksStatus {
  books_dir_exists: boolean;
  ebook_count: number;
  abs: { installed: boolean; running: boolean };
  calibreweb: { installed: boolean; running: boolean };
}

export interface BookProgress {
  cfi: string;
  fraction: number | null;
  updated_at: string;
}

export interface Book {
  id: string;
  relpath: string;
  title: string;
  author: string | null;
  /** Relative cover path ('/books/<id>/cover') or null when the EPUB has none. */
  cover: string | null;
  size_bytes: number;
  modified_at: string;
  progress: BookProgress | null;
}

export interface BookAnnotation {
  id: string;
  cfi: string;
  color: string;
  note: string | null;
  selected_text: string | null;
  created_at: string;
}

export interface SaveProgressBody {
  cfi: string;
  fraction: number;
}

export interface CreateAnnotationBody {
  cfi: string;
  color: string;
  note?: string;
  selected_text?: string;
}

export interface AudioProgress {
  current_time: number;
  is_finished: boolean;
}

export interface AudioItem {
  id: string;
  title: string;
  author: string | null;
  duration_seconds: number;
  /** Relative cover path ('/books/audio/cover/<id>'). */
  cover: string;
  progress: AudioProgress | null;
}

export interface AudioChapter {
  id: string;
  start: number;
  end: number;
  title: string;
}

export interface AudioTrack {
  index: number;
  /** Offset (SECONDS) of this track within the whole audiobook. */
  start_offset: number;
  duration: number;
  /** OUR proxy path ('/books/audio/stream/...') — never a raw ABS URL. */
  content_url: string | null;
}

export interface AudioItemDetail {
  id: string;
  title: string;
  author: string | null;
  duration_seconds: number;
  description: string | null;
  chapters: AudioChapter[];
  tracks: AudioTrack[];
}

export interface AudioPlaySession {
  session_id: string;
  current_time: number;
  duration_seconds: number;
  tracks: AudioTrack[];
  chapters: AudioChapter[];
}

export interface SyncSessionBody {
  current_time: number;
  time_listened: number;
}

export interface CloseSessionBody {
  current_time?: number;
}

// ─── URL helpers ─────────────────────────────────────────

/**
 * Authenticated cover URL for `<img src>`. The auth plugin accepts
 * `?token=<jwt>` for media elements (music coverUrl pattern).
 */
export function coverUrl(id: string): string {
  const token = useAuthStore.getState().tokens?.accessToken ?? '';
  return `${BASE_URL}/api/v1/books/${encodeURIComponent(id)}/cover?token=${token}`;
}

/** Authenticated audiobook cover URL (proxied from Audiobookshelf). */
export function audioCoverUrl(id: string): string {
  const token = useAuthStore.getState().tokens?.accessToken ?? '';
  return `${BASE_URL}/api/v1/books/audio/cover/${encodeURIComponent(id)}?token=${token}`;
}

/** Authenticated EPUB file URL (Range-capable) for the reader. */
export function fileUrl(id: string): string {
  const token = useAuthStore.getState().tokens?.accessToken ?? '';
  return `${BASE_URL}/api/v1/books/${encodeURIComponent(id)}/file?token=${token}`;
}

// ─── Reader API ──────────────────────────────────────────

export async function status(): Promise<BooksStatus> {
  const res = await api.get<{ data: BooksStatus }>('/books/status');
  return res.data;
}

export async function listBooks(): Promise<Book[]> {
  const res = await api.get<{ data: { books: Book[] } }>('/books');
  return res.data.books;
}

/** Natural-language search (Fase 5 Slice A). semantic=false → keyword título/autor. */
export async function searchBooks(q: string, semantic: boolean, limit = 40): Promise<Book[]> {
  const res = await api.get<{ data: { books: Book[] } }>('/books/search', {
    q, limit, ...(semantic ? { semantic: '1' } : {}),
  });
  return res.data.books;
}

export async function getProgress(id: string): Promise<BookProgress | null> {
  const res = await api.get<{ data: { progress: BookProgress | null } }>(
    `/books/${encodeURIComponent(id)}/progress`,
  );
  return res.data.progress;
}

export async function saveProgress(id: string, body: SaveProgressBody): Promise<void> {
  await api.put<void>(`/books/${encodeURIComponent(id)}/progress`, body);
}

export async function listAnnotations(id: string): Promise<BookAnnotation[]> {
  const res = await api.get<{ data: { annotations: BookAnnotation[] } }>(
    `/books/${encodeURIComponent(id)}/annotations`,
  );
  return res.data.annotations;
}

export async function createAnnotation(
  id: string,
  body: CreateAnnotationBody,
): Promise<BookAnnotation> {
  const res = await api.post<{ data: { annotation: BookAnnotation } }>(
    `/books/${encodeURIComponent(id)}/annotations`,
    body,
  );
  return res.data.annotation;
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  await api.delete<void>(`/books/annotations/${encodeURIComponent(annotationId)}`);
}

// ─── Audiobooks API ──────────────────────────────────────

export async function listAudio(): Promise<AudioItem[]> {
  const res = await api.get<{ data: { items: AudioItem[] } }>('/books/audio');
  return res.data.items;
}

export async function getAudioItem(id: string): Promise<AudioItemDetail> {
  const res = await api.get<{ data: { item: AudioItemDetail } }>(
    `/books/audio/${encodeURIComponent(id)}`,
  );
  return res.data.item;
}

export async function playAudio(id: string): Promise<AudioPlaySession> {
  const res = await api.post<{ data: AudioPlaySession }>(
    `/books/audio/${encodeURIComponent(id)}/play`,
  );
  return res.data;
}

export async function syncSession(id: string, body: SyncSessionBody): Promise<void> {
  await api.post<void>(`/books/audio/sessions/${encodeURIComponent(id)}/sync`, body);
}

export async function closeSession(id: string, body?: CloseSessionBody): Promise<void> {
  await api.post<void>(`/books/audio/sessions/${encodeURIComponent(id)}/close`, body ?? {});
}

// ─── Aggregate (music.service pattern) ───────────────────

export const booksService = {
  status,
  listBooks,
  searchBooks,
  coverUrl,
  audioCoverUrl,
  fileUrl,
  getProgress,
  saveProgress,
  listAnnotations,
  createAnnotation,
  deleteAnnotation,
  listAudio,
  getAudioItem,
  playAudio,
  syncSession,
  closeSession,
};
