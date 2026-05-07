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

import { useState, useEffect, useCallback } from 'react';
import { Brain, Trash2, RefreshCw, Clock, Tag, MessageSquare, Pen, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as preferencesSvc from '@/services/preferences.service';
import { SettingSection } from '../SettingSection';

interface LearnedPreference {
  id: string;
  category: string;
  key: string;
  value: any;
  description: string;
  source: string;
  ai_comment: string | null;
  confidence: number;
  evidence_count: number;
  last_observed_at: string;
  created_at: string;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  scheduling:     { label: 'Horarios',       icon: Clock,          color: 'text-cyan-400' },
  organization:   { label: 'Organizacion',   icon: Tag,            color: 'text-amber-400' },
  communication:  { label: 'Comunicacion',   icon: MessageSquare,  color: 'text-green-400' },
  writing_style:  { label: 'Estilo',         icon: Pen,            color: 'text-purple-400' },
};

const DEFAULT_META = { label: 'Otro', icon: HelpCircle, color: 'text-[var(--text-muted)]' };

function confidenceLabel(c: number): string {
  if (c >= 0.9) return 'Muy alta';
  if (c >= 0.7) return 'Alta';
  if (c >= 0.5) return 'Media';
  return 'Baja';
}

function confidenceColor(c: number): string {
  if (c >= 0.9) return 'bg-green-400';
  if (c >= 0.7) return 'bg-amber-400';
  if (c >= 0.5) return 'bg-yellow-400';
  return 'bg-red-400';
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es');
}

export function PreferencesSection() {
  const [preferences, setPreferences] = useState<LearnedPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPreferences(await preferencesSvc.listPreferences());
    } catch {
      // pro tier — may not be available
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    const toastId = toast.loading('Generando comentarios AI...');

    try {
      await preferencesSvc.regenerateComments();
    } catch {
      toast.error('No se pudieron regenerar los comentarios', { id: toastId });
      setRegenerating(false);
      return;
    }

    // Poll every 3 seconds to show comments appearing progressively
    let polls = 0;
    const maxPolls = 20; // 60 seconds max
    const previousComments = new Set(preferences.filter(p => p.ai_comment).map(p => p.id));

    const poll = setInterval(async () => {
      polls++;
      try {
        const updated = await preferencesSvc.listPreferences();
        setPreferences(updated);

        // Count how many NEW comments appeared
        const currentComments = new Set(updated.filter(p => p.ai_comment).map(p => p.id));
        const newCount = [...currentComments].filter(id => !previousComments.has(id)).length;
        const total = updated.filter(p => p.confidence >= 0.6).length;
        const withComments = updated.filter(p => p.ai_comment).length;

        toast.loading(`Generando comentarios AI... (${withComments}/${total})`, { id: toastId });

        // Stop if all eligible prefs have comments, or timeout
        if (withComments >= total || polls >= maxPolls) {
          clearInterval(poll);
          setRegenerating(false);
          toast.success(`${withComments} comentarios AI generados`, { id: toastId });
        }
      } catch {
        // Silently continue polling
      }
    }, 3000);
  }, [load, preferences]);

  const handleForget = async (id: string) => {
    setDeleting(id);
    try {
      await preferencesSvc.deletePreference(id);
      setPreferences(prev => prev.filter(p => p.id !== id));
      toast.success('Preference forgotten');
    } catch {
      toast.error('Failed to forget preference');
    }
    setDeleting(null);
  };

  // Group by category
  const grouped = preferences.reduce<Record<string, LearnedPreference[]>>((acc, p) => {
    const cat = p.category || 'other';
    (acc[cat] ??= []).push(p);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort((a, b) => {
    const order = ['scheduling', 'organization', 'communication', 'writing_style'];
    return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
  });

  return (
    <SettingSection
      title="Learned Preferences"
      description="El sistema aprende de tu comportamiento para ofrecerte sugerencias mas precisas. Cada preferencia se refina con el tiempo conforme acumula evidencia. Si algo es incorrecto, puedes olvidarlo — el sistema dejara de usar esa informacion."
      action={
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="p-1.5 rounded hover:bg-[var(--surface-hover)]"
          title="Regenerar comentarios AI"
        >
          <RefreshCw size={14} className={`text-[var(--text-muted)] ${regenerating ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      {loading ? null : preferences.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">
          <Brain size={24} className="mx-auto mb-2 opacity-40" />
          <div>No hay preferencias aprendidas aun</div>
          <div className="text-[11px] mt-1">El sistema aprende automaticamente mientras usas la plataforma. Las preferencias se generan durante periodos de inactividad.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => {
            const meta = CATEGORY_META[cat] ?? DEFAULT_META;
            const CatIcon = meta.icon;
            const items = grouped[cat];

            return (
              <div key={cat}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-2">
                  <CatIcon size={14} className={meta.color} />
                  <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">({items.length})</span>
                </div>

                {/* Preference cards */}
                <div className="space-y-1.5">
                  {items.map(pref => {
                    const pct = Math.round(pref.confidence * 100);

                    return (
                      <div key={pref.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] group">
                        <div className="flex-1 min-w-0">
                          {/* Description (human-readable) */}
                          <div className="text-xs font-medium text-[var(--text)] mb-1.5">
                            {pref.description}
                          </div>

                          {/* Confidence bar + metadata */}
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Confidence */}
                            <div className="flex items-center gap-1.5">
                              <div className="w-20 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${confidenceColor(pref.confidence)}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-[var(--text-muted)]">{pct}% — {confidenceLabel(pref.confidence)}</span>
                            </div>

                            {/* Evidence count */}
                            {pref.evidence_count > 0 && (
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {pref.evidence_count} observaciones
                              </span>
                            )}

                            {/* Last observed */}
                            {pref.last_observed_at && (
                              <span className="text-[10px] text-[var(--text-muted)]">
                                Visto {timeAgo(pref.last_observed_at)}
                              </span>
                            )}
                          </div>

                          {/* Source explanation */}
                          {pref.source && (
                            <div className="text-[10px] text-[var(--text-dim)] mt-1">
                              Fuente: {pref.source}
                            </div>
                          )}
                        </div>

                        {/* RIGHT: AI comment */}
                        {pref.ai_comment && (
                          <div className="w-[40%] flex-shrink-0 text-[13px] text-amber-400/80 italic leading-relaxed border-l border-amber-400/20 pl-3 line-clamp-4">
                            {pref.ai_comment}
                          </div>
                        )}

                        {/* Forget button */}
                        <button
                          onClick={() => handleForget(pref.id)}
                          disabled={deleting === pref.id}
                          className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Olvidar esta preferencia"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Footer explanation */}
          <div className="text-[10px] text-[var(--text-dim)] pt-2 border-t border-[var(--border)]">
            Las preferencias se actualizan cada 30 minutos cuando estas inactivo. La confianza crece con cada observacion (max 95%). Olvidar una preferencia envia una señal negativa — el sistema puede re-aprenderla pero con menor confianza.
          </div>
        </div>
      )}
    </SettingSection>
  );
}
