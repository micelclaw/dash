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

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, MapPin, ClipboardCheck, ArrowRightLeft, LogIn, Keyboard, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useInventoryStore } from '@/stores/inventory.store';
import type { InventoryItem, InventoryLocation } from '@/modules/inventory/types';
import { recordCountWithOptionalEvidence } from './count-evidence';

export type ScanIntent = 'locate' | 'count' | 'move' | 'checkinout';

export const SCAN_INTENTS: { id: ScanIntent; label: string; hint: string; Icon: typeof MapPin }[] = [
  { id: 'locate', label: 'Locate', hint: 'Open the scanned item or bin', Icon: MapPin },
  { id: 'count', label: 'Count', hint: 'Adjust quantity (stock count)', Icon: ClipboardCheck },
  { id: 'move', label: 'Move to bin', hint: 'Transfer the item to a location', Icon: ArrowRightLeft },
  { id: 'checkinout', label: 'Check in / out', hint: 'Return a loan (or open to lend)', Icon: LogIn },
];

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const panel: CSSProperties = {
  width: 'min(440px, 96vw)', maxHeight: '92vh', overflowY: 'auto', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-lg, 12px)', boxShadow: 'var(--shadow-lg)',
  display: 'flex', flexDirection: 'column',
};
const inputStyle: CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text)', padding: '8px 10px', fontSize: '0.875rem', outline: 'none', width: '100%', boxSizing: 'border-box',
};
const btnPrimary: CSSProperties = {
  background: 'var(--amber)', color: '#06060a', fontWeight: 600, border: 'none',
  borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: '0.875rem', cursor: 'pointer',
};
const btnSecondary: CSSProperties = {
  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: '0.875rem', cursor: 'pointer',
};

const REGION_ID = 'inv-scan-region';

/** Parsea un código escaneado (URL del QR o uuid pelado) → {kind,id}. */
type ParsedCode = { kind: 'item'; id: string } | { kind: 'location'; id: string } | { kind: 'unknown'; raw: string };
function parseCode(raw: string): ParsedCode {
  const s = raw.trim();
  try {
    const url = new URL(s);
    const loc = url.searchParams.get('location_id');
    const id = url.searchParams.get('id');
    if (loc) return { kind: 'location', id: loc };
    if (id) return { kind: 'item', id };
  } catch { /* no es URL */ }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return { kind: 'item', id: s };
  return { kind: 'unknown', raw: s };
}

export function ScannerModal({ intent, onClose }: { intent: ScanIntent; onClose: () => void }) {
  const meta = SCAN_INTENTS.find(i => i.id === intent)!;
  const selectItem = useInventoryStore(s => s.selectItem);
  const recordMove = useInventoryStore(s => s.recordMove);
  const uploadItemFile = useInventoryStore(s => s.uploadItemFile);
  const returnItem = useInventoryStore(s => s.returnItem);
  const locations = useInventoryStore(s => s.locations);
  const fetchLocations = useInventoryStore(s => s.fetchLocations);

  const [manual, setManual] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Flujo de 2 pasos (item → destino) para 'count'/'move'
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [countValue, setCountValue] = useState('');
  const [countPhoto, setCountPhoto] = useState<File | null>(null);
  const [countPhotoFileId, setCountPhotoFileId] = useState<string | null>(null);
  const [destLocation, setDestLocation] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  useEffect(() => { if (!locations.length) void fetchLocations(); }, [locations.length, fetchLocations]);

  const resolveItem = useCallback(async (id: string): Promise<InventoryItem | null> => {
    try {
      const res = await api.get<{ data: InventoryItem }>(`/inventory/items/${id}`);
      return res.data;
    } catch { return null; }
  }, []);

  const resolveByText = useCallback(async (text: string): Promise<InventoryItem | null> => {
    try {
      const res = await api.get<{ data: InventoryItem[] }>('/inventory/items', { search: text, limit: 1 });
      return res.data[0] ?? null;
    } catch { return null; }
  }, []);

  const handleCode = useCallback(async (raw: string) => {
    if (handledRef.current) return;
    handledRef.current = true;
    setBusy(true);
    try {
      const parsed = parseCode(raw);
      // LOCATE — abre item o ubicación
      if (intent === 'locate') {
        if (parsed.kind === 'location') {
          window.location.assign(`/inventory?location_id=${parsed.id}`);
        } else if (parsed.kind === 'item') {
          selectItem(parsed.id);
          onClose();
        } else {
          const it = await resolveByText(parsed.raw);
          if (it) { selectItem(it.id); onClose(); }
          else { toast.error('Code not recognized'); handledRef.current = false; }
        }
        return;
      }
      // Resto de intenciones operan sobre un ITEM
      let it: InventoryItem | null = null;
      if (parsed.kind === 'item') it = await resolveItem(parsed.id);
      else if (parsed.kind === 'unknown') it = await resolveByText(parsed.raw);
      else { toast.error('Scan an item, not a bin'); handledRef.current = false; return; }
      if (!it) { toast.error('Item not found'); handledRef.current = false; return; }

      if (intent === 'checkinout') {
        if (it.lent_to_contact_id || it.status === 'lent') {
          await returnItem(it.id);
          toast.success(`${it.name} checked in (returned)`);
          onClose();
        } else {
          selectItem(it.id);
          toast.info('Use “Lend” in the item panel to check it out');
          onClose();
        }
        return;
      }
      // count / move → pasan al paso 2 con el item resuelto
      setItem(it);
      setCountValue(intent === 'count' ? String(it.quantity ?? '') : '');
    } finally {
      setBusy(false);
    }
  }, [intent, selectItem, onClose, resolveItem, resolveByText, returnItem]);

  // Cámara (html5-qrcode). Best-effort: si falla el permiso o no hay cámara,
  // queda el fallback manual. El flag `started` evita el throw síncrono de
  // stop() en el cleanup de StrictMode (cuando start() aún no ha resuelto).
  useEffect(() => {
    if (item) return; // ya resuelto, no escanear más
    let cancelled = false;
    let started = false;
    const stopSafe = (s: Html5Qrcode) => { try { s.stop().then(() => s.clear()).catch(() => {}); } catch { /* not running */ } };
    let scanner: Html5Qrcode;
    try { scanner = new Html5Qrcode(REGION_ID, { verbose: false }); }
    catch (err) { setCameraError(String((err as Error)?.message ?? err)); return; }
    scannerRef.current = scanner;
    scanner
      .start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => { if (!cancelled) void handleCode(decoded); },
        () => { /* frame sin QR: ignorar */ })
      .then(() => { started = true; if (cancelled) stopSafe(scanner); else setCameraOn(true); })
      .catch((err) => { if (!cancelled) setCameraError(String(err?.message ?? err)); });
    return () => {
      cancelled = true;
      if (started) stopSafe(scanner);
      scannerRef.current = null;
    };
  }, [item, handleCode]);

  const submitManual = () => { if (manual.trim()) void handleCode(manual.trim()); };

  const doCount = async () => {
    if (!item) return;
    const target = parseFloat(countValue);
    if (!Number.isFinite(target) || target < 0) { toast.error('Enter a valid count'); return; }
    const delta = Math.round((target - parseFloat(String(item.quantity ?? 0))) * 1000) / 1000;
    if (delta === 0) { toast.info('Count matches — no change'); onClose(); return; }
    setBusy(true);
    try {
      await recordCountWithOptionalEvidence({
        item_id: item.id,
        qty_delta: delta,
        photo: countPhoto,
        uploaded_file_id: countPhotoFileId,
        upload: file => uploadItemFile(item.id, file, 'photo'),
        remember_upload: setCountPhotoFileId,
        record: recordMove,
      });
      toast.success(`Count adjusted (${delta > 0 ? '+' : ''}${delta})`);
      onClose();
    } catch { toast.error('Could not adjust count'); }
    finally { setBusy(false); }
  };

  const doMove = async () => {
    if (!item || !destLocation) { toast.error('Pick a destination bin'); return; }
    setBusy(true);
    try {
      await recordMove({ item_id: item.id, type: 'transfer', to_location_id: destLocation, from_location_id: item.location_id ?? null });
      toast.success(`${item.name} moved`);
      onClose();
    } catch { toast.error('Could not move item'); }
    finally { setBusy(false); }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <meta.Icon size={16} style={{ color: 'var(--mod-inventory, var(--amber))' }} />
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>Scan · {meta.label}</span>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Paso 1: escanear/resolver (oculto cuando ya hay item para count/move) */}
          {!item && (
            <>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>{meta.hint}</div>
              <div id={REGION_ID} style={{ width: '100%', minHeight: cameraOn ? 220 : 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: cameraOn ? '#000' : 'transparent' }} />
              {!cameraOn && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: cameraError ? 'var(--danger, #f43f5e)' : 'var(--text-dim)' }}>
                  <Camera size={13} />
                  {cameraError ? 'Camera unavailable — type or paste the code below' : 'Starting camera…'}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Keyboard size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                <input
                  style={inputStyle}
                  placeholder="Paste QR link, asset tag (INV-…) or id"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }}
                  aria-label="Manual code"
                />
                <button style={btnSecondary} disabled={busy || !manual.trim()} onClick={submitManual}>Use</button>
              </div>
            </>
          )}

          {/* Paso 2: count */}
          {item && intent === 'count' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ItemBadge item={item} />
              <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Counted quantity (was {String(item.quantity ?? 0)})</label>
              <input style={inputStyle} type="number" min="0" value={countValue} onChange={(e) => setCountValue(e.target.value)} autoFocus aria-label="Counted quantity" />
              <label style={{ ...btnSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: busy ? 'default' : 'pointer' }}>
                <Camera size={14} />
                {countPhoto ? `Evidence: ${countPhoto.name}` : 'Add optional count photo'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={busy}
                  style={{ display: 'none' }}
                  onChange={event => {
                    setCountPhoto(event.target.files?.[0] ?? null);
                    setCountPhotoFileId(null);
                  }}
                />
              </label>
              {countPhoto && (
                <button type="button" style={{ ...btnSecondary, alignSelf: 'flex-start', padding: '4px 8px' }} disabled={busy} onClick={() => { setCountPhoto(null); setCountPhotoFileId(null); }}>
                  Remove photo
                </button>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button style={btnSecondary} onClick={onClose}>Cancel</button>
                <button style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void doCount()}>Adjust count</button>
              </div>
            </div>
          )}

          {/* Paso 2: move */}
          {item && intent === 'move' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ItemBadge item={item} />
              <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Move to bin</label>
              <select style={inputStyle} value={destLocation} onChange={(e) => setDestLocation(e.target.value)} aria-label="Destination bin">
                <option value="">— pick a location —</option>
                {locations.map((l: InventoryLocation) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button style={btnSecondary} onClick={onClose}>Cancel</button>
                <button style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void doMove()}>Move</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemBadge({ item }: { item: InventoryItem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{item.name}</span>
      {item.asset_tag && <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>🏷 {item.asset_tag}</span>}
    </div>
  );
}
