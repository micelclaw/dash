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

// F2b (pulido) — Ajustes de Facturación: gestión de tarifas de IVA. Hasta ahora
// solo se podían crear por API/agente; aquí el usuario crea/borra sus tipos de IVA
// (nombre, % e inclusive/exclusive), que luego elige por línea en el editor.

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Percent, Palette, Image as ImageIcon, Upload, Building2, Package } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import { useFinanceBillingStore, type TaxMode, type BillingAddress } from '@/stores/finance-billing.store';

// Tipografías que puede elegir el usuario para sus facturas. El `value` es lo
// que se guarda en finance_brand.font_family (CSS font-family que usa el render
// server-side); el `label` es lo que ve en el desplegable.
const FONT_PRESETS: { label: string; value: string }[] = [
  { label: 'Sistema', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Inter', value: "'Inter', system-ui, sans-serif" },
  { label: 'Serif', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Mono', value: "'JetBrains Mono', 'Courier New', monospace" },
];

const DEFAULT_ACCENT = '#4338ca';

function fontLabel(value: string | null): string {
  return FONT_PRESETS.find((f) => f.value === value)?.label ?? 'Sistema';
}

export function FacturacionAjustesTab() {
  const isMobile = useIsMobile();
  const { taxRates, fetchTaxRates, createTaxRate, deleteTaxRate, fetchBrand, saveBrand, fetchCompany, saveCompany, fetchCrossDomainSettings, saveCrossDomainSettings } = useFinanceBillingStore();
  const [name, setName] = useState('');
  const [ratePct, setRatePct] = useState('21');
  const [mode, setMode] = useState<TaxMode>('exclusive');
  const [busy, setBusy] = useState(false);

  // ─── Estado de empresa emisora (cabecera del PDF) ─────────────────────────
  const [coName, setCoName] = useState('');
  const [coLegalName, setCoLegalName] = useState('');
  const [coTaxId, setCoTaxId] = useState('');
  const [coLine1, setCoLine1] = useState('');
  const [coCity, setCoCity] = useState('');
  const [coPostalCode, setCoPostalCode] = useState('');
  const [coCountry, setCoCountry] = useState('');
  const [coCurrency, setCoCurrency] = useState('EUR');
  const [coEmail, setCoEmail] = useState('');
  const [coPhone, setCoPhone] = useState('');
  const [coBusy, setCoBusy] = useState(false);

  // ─── Cruce con inventario (opt-in) ───────────────────────────────────────
  const [proposeItems, setProposeItems] = useState(false);
  const [cdBusy, setCdBusy] = useState(false);

  // ─── Estado de marca ─────────────────────────────────────────────────────
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [fontFamily, setFontFamily] = useState(FONT_PRESETS[0]?.value ?? '');
  const [logo, setLogo] = useState('');
  const [brandBusy, setBrandBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void fetchTaxRates(); }, [fetchTaxRates]);

  useEffect(() => {
    void (async () => {
      try {
        const b = await fetchBrand();
        if (b.accent_color) setAccent(b.accent_color);
        if (b.font_family) setFontFamily(b.font_family);
        if (b.logo) setLogo(b.logo);
      } catch {
        /* sin marca aún: se quedan los defaults */
      }
    })();
  }, [fetchBrand]);

  // Carga los datos de la empresa emisora al montar; si no existe aún, se quedan
  // los defaults vacíos y el usuario los rellena por primera vez.
  useEffect(() => {
    void (async () => {
      try {
        const c = await fetchCompany();
        if (!c) return;
        setCoName(c.name ?? '');
        setCoLegalName(c.legal_name ?? '');
        setCoTaxId(c.tax_id ?? '');
        const addr = c.billing_address;
        if (addr) {
          setCoLine1(addr.line1 ?? '');
          setCoCity(addr.city ?? '');
          setCoPostalCode(addr.postal_code ?? '');
          setCoCountry(addr.country ?? '');
        }
        if (c.default_currency) setCoCurrency(c.default_currency);
        const cf = c.custom_fields ?? {};
        if (typeof cf.email === 'string') setCoEmail(cf.email);
        if (typeof cf.phone === 'string') setCoPhone(cf.phone);
      } catch {
        /* sin empresa aún: defaults vacíos */
      }
    })();
  }, [fetchCompany]);

  // Carga el opt-in del cruce con inventario al montar.
  useEffect(() => {
    void (async () => {
      try { setProposeItems((await fetchCrossDomainSettings()).bill_propose_items); } catch { /* default off */ }
    })();
  }, [fetchCrossDomainSettings]);

  // Guarda el toggle al instante (sin botón).
  const onToggleProposeItems = async (next: boolean) => {
    setProposeItems(next); // optimista
    setCdBusy(true);
    try {
      const r = await saveCrossDomainSettings({ bill_propose_items: next });
      setProposeItems(r.bill_propose_items);
      toast.success(next ? 'Activado: las facturas recibidas propondrán artículos nuevos' : 'Desactivado');
    } catch (e) {
      setProposeItems(!next); // revertir
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el ajuste');
    } finally {
      setCdBusy(false);
    }
  };

  // Hex válido (#abc o #aabbcc). El input color ya da hex; el de texto puede
  // estar a medio escribir, así que solo lo aplicamos al swatch si es válido.
  const accentValid = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(accent);

  const onSaveCompany = async () => {
    if (!coName.trim()) { toast.error('Pon al menos el nombre comercial de tu empresa'); return; }
    setCoBusy(true);
    try {
      // Solo mandamos la dirección si tiene algún campo; si no, se omite (no [{}]).
      const addr: BillingAddress = {
        line1: coLine1.trim() || null,
        city: coCity.trim() || null,
        postal_code: coPostalCode.trim() || null,
        country: coCountry.trim() || null,
      };
      const hasAddr = !!(coLine1.trim() || coCity.trim() || coPostalCode.trim() || coCountry.trim());
      await saveCompany({
        name: coName.trim(),
        legal_name: coLegalName.trim() || undefined,
        tax_id: coTaxId.trim() || undefined,
        billing_address: hasAddr ? addr : undefined,
        default_currency: coCurrency.trim() || undefined,
        email: coEmail.trim() || undefined,
        phone: coPhone.trim() || undefined,
      });
      toast.success('Datos de empresa guardados');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron guardar los datos de empresa');
    } finally {
      setCoBusy(false);
    }
  };

  const onSaveBrand = async () => {
    if (!accentValid) { toast.error('El color de acento no es un hex válido (p.ej. #4338ca)'); return; }
    setBrandBusy(true);
    try {
      await saveBrand({
        accent_color: accent,
        font_family: fontFamily,
        logo: logo.trim() ? logo.trim() : null,
      });
      toast.success('Marca guardada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la marca');
    } finally {
      setBrandBusy(false);
    }
  };

  const onPickLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = ''; // permite re-elegir el mismo archivo
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('El logo debe ser una imagen'); return; }
    if (file.size > 512 * 1024) { toast.error('El logo es muy grande (máx. 512 KB). Usa una URL si pesa más.'); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') setLogo(reader.result); };
    reader.onerror = () => toast.error('No se pudo leer el archivo');
    reader.readAsDataURL(file);
  };

  const onCreate = async () => {
    const pct = Number(String(ratePct).replace(',', '.'));
    if (!name.trim()) { toast.error('Pon un nombre a la tarifa'); return; }
    if (isNaN(pct) || pct < 0 || pct > 100) { toast.error('El porcentaje debe estar entre 0 y 100'); return; }
    setBusy(true);
    try {
      await createTaxRate({ name: name.trim(), rate: String(pct / 100), mode });
      toast.success('Tarifa creada');
      setName('');
      setRatePct('21');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string, label: string) => {
    if (!window.confirm(`¿Borrar la tarifa "${label}"? Las facturas ya emitidas conservan su IVA (snapshot); solo deja de ofrecerse para nuevas líneas.`)) return;
    try {
      await deleteTaxRate(id);
      toast.success('Tarifa borrada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo borrar');
    }
  };

  const fieldStyle: React.CSSProperties = { padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', color: 'var(--text)', fontSize: 13 };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, display: 'block' };

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Percent size={16} style={{ color: 'var(--mod-finance)' }} />
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Tarifas de IVA</h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 18 }}>
        Tipos de IVA que podrás elegir por línea al crear facturas. "Exclusivo" = el IVA se suma al precio; "Inclusivo" = el precio ya lleva el IVA incorporado.
      </p>

      {/* Alta */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14, marginBottom: 20 }}>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <label style={labelStyle}>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="IVA general" style={{ ...fieldStyle, width: '100%' }} />
        </div>
        <div style={{ width: 100 }}>
          <label style={labelStyle}>%</label>
          <input value={ratePct} onChange={(e) => setRatePct(e.target.value)} inputMode="decimal" style={{ ...fieldStyle, width: '100%', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }} />
        </div>
        <div style={{ width: 140 }}>
          <label style={labelStyle}>Modo</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as TaxMode)} style={{ ...fieldStyle, width: '100%' }}>
            <option value="exclusive">Exclusivo</option>
            <option value="inclusive">Inclusivo</option>
          </select>
        </div>
        <button onClick={onCreate} disabled={busy} style={{ padding: '8px 16px', background: 'var(--mod-finance)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#fff', cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, height: 36 }}>
          {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
          Añadir
        </button>
      </div>

      {/* Lista */}
      {taxRates.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          Aún no tienes tarifas de IVA. Crea la primera arriba (p.ej. "IVA general", 21%, exclusivo).
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', overflow: 'hidden' }}>
          {taxRates.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{t.name}</div>
              <div style={{ width: 70, textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>{(Number(t.rate) * 100).toFixed(0)}%</div>
              <div style={{ width: 90, textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>{t.mode === 'inclusive' ? 'Inclusivo' : 'Exclusivo'}</div>
              <button onClick={() => onDelete(t.id, t.name)} title="Borrar tarifa" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── Datos de tu empresa (emisor del PDF) ──────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 36, marginBottom: 4 }}>
        <Building2 size={16} style={{ color: 'var(--mod-finance)' }} />
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Datos de tu empresa</h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 18 }}>
        Estos datos salen en la cabecera de tus facturas (PDF).
      </p>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 16, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Nombre + razón social */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Nombre comercial</label>
            <input value={coName} onChange={(e) => setCoName(e.target.value)} placeholder="Mi Empresa S.L." style={{ ...fieldStyle, width: '100%' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Razón social</label>
            <input value={coLegalName} onChange={(e) => setCoLegalName(e.target.value)} placeholder="Razón social (opcional)" style={{ ...fieldStyle, width: '100%' }} />
          </div>
        </div>

        {/* NIF/CIF + divisa */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>NIF/CIF</label>
            <input value={coTaxId} onChange={(e) => setCoTaxId(e.target.value)} placeholder="B12345678" style={{ ...fieldStyle, width: '100%' }} />
          </div>
          <div style={{ width: 120 }}>
            <label style={labelStyle}>Divisa</label>
            <input value={coCurrency} onChange={(e) => setCoCurrency(e.target.value.toUpperCase())} placeholder="EUR" maxLength={3} style={{ ...fieldStyle, width: '100%', textTransform: 'uppercase' }} />
          </div>
        </div>

        {/* Dirección */}
        <div>
          <label style={labelStyle}>Dirección</label>
          <input value={coLine1} onChange={(e) => setCoLine1(e.target.value)} placeholder="Calle y número" style={{ ...fieldStyle, width: '100%', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <input value={coPostalCode} onChange={(e) => setCoPostalCode(e.target.value)} placeholder="C.P." style={{ ...fieldStyle, width: 110 }} />
            <input value={coCity} onChange={(e) => setCoCity(e.target.value)} placeholder="Ciudad" style={{ ...fieldStyle, flex: 1, minWidth: 0 }} />
            <input value={coCountry} onChange={(e) => setCoCountry(e.target.value)} placeholder="País" style={{ ...fieldStyle, flex: 1, minWidth: 0 }} />
          </div>
        </div>

        {/* Email + teléfono */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Email (opcional)</label>
            <input value={coEmail} onChange={(e) => setCoEmail(e.target.value)} type="email" placeholder="hola@miempresa.com" style={{ ...fieldStyle, width: '100%' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Teléfono (opcional)</label>
            <input value={coPhone} onChange={(e) => setCoPhone(e.target.value)} placeholder="+34 600 000 000" style={{ ...fieldStyle, width: '100%' }} />
          </div>
        </div>

        <div>
          <button onClick={onSaveCompany} disabled={coBusy} style={{ padding: '8px 18px', background: 'var(--mod-finance)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#fff', cursor: coBusy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {coBusy && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Guardar datos de empresa
          </button>
        </div>
      </div>

      {/* ─── Marca de tus facturas ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 36, marginBottom: 4 }}>
        <Palette size={16} style={{ color: 'var(--mod-finance)' }} />
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Marca de tus facturas</h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 18 }}>
        Personaliza el aspecto de los PDF y la vista previa de tus facturas: color de acento, tipografía y logo.
      </p>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 18, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 16, marginBottom: 14 }}>
        {/* Controles */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {/* Color de acento */}
          <div>
            <label style={labelStyle}>Color de acento</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={accentValid ? accent : DEFAULT_ACCENT}
                onChange={(e) => setAccent(e.target.value)}
                style={{ width: 40, height: 36, padding: 2, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', cursor: 'pointer' }}
              />
              <input
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                placeholder="#4338ca"
                style={{ ...fieldStyle, width: 120, fontFamily: 'var(--font-mono, monospace)' }}
              />
            </div>
          </div>

          {/* Tipografía */}
          <div>
            <label style={labelStyle}>Tipografía</label>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} style={{ ...fieldStyle, width: 220 }}>
              {FONT_PRESETS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          {/* Logo */}
          <div>
            <label style={labelStyle}>Logo (URL de imagen)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="https://… o sube un archivo"
                style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                title="Subir archivo"
                style={{ ...fieldStyle, width: 'auto', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Upload size={14} /> Subir
              </button>
              {logo && (
                <button
                  onClick={() => setLogo('')}
                  title="Quitar logo"
                  style={{ ...fieldStyle, width: 'auto', cursor: 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickLogoFile} style={{ display: 'none' }} />
          </div>

          <div>
            <button onClick={onSaveBrand} disabled={brandBusy} style={{ padding: '8px 18px', background: 'var(--mod-finance)', border: 'none', borderRadius: 'var(--radius-md, 6px)', color: '#fff', cursor: brandBusy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {brandBusy && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Guardar marca
            </button>
          </div>
        </div>

        {/* Mini-vista de feedback */}
        <div style={{ width: isMobile ? '100%' : 200, flexShrink: 0, borderLeft: isMobile ? 'none' : '1px solid var(--border)', borderTop: isMobile ? '1px solid var(--border)' : 'none', paddingLeft: isMobile ? 0 : 18, paddingTop: isMobile ? 14 : 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Vista</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: accentValid ? accent : DEFAULT_ACCENT, border: '1px solid var(--border)', flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>{accentValid ? accent : 'inválido'}</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Tipografía</div>
          <div style={{ fontSize: 15, color: 'var(--text)', fontFamily: fontFamily, marginBottom: 14 }}>
            {fontLabel(fontFamily)} · Abc 123
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Logo</div>
          <div style={{ width: '100%', height: 64, borderRadius: 6, border: '1px dashed var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {logo ? (
              <img src={logo} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <ImageIcon size={20} style={{ color: 'var(--text-muted)' }} />
            )}
          </div>
        </div>
      </div>

      {/* ─── Conexión con inventario (opt-in) ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 36, marginBottom: 4 }}>
        <Package size={16} style={{ color: 'var(--mod-finance)' }} />
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Conexión con inventario</h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 18 }}>
        Cuando vinculas una línea de factura a un artículo existente, al registrar la factura el stock se ajusta solo (entra en compras, sale en ventas). Esto es siempre así. El ajuste de abajo es opcional.
      </p>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 16, marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: cdBusy ? 'wait' : 'pointer' }}>
          <input
            type="checkbox"
            checked={proposeItems}
            disabled={cdBusy}
            onChange={(e) => void onToggleProposeItems(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--mod-finance)', cursor: cdBusy ? 'wait' : 'pointer' }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              Proponer artículos nuevos desde facturas recibidas
              {cdBusy && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Si una línea de una factura recibida NO está vinculada a ningún artículo, se crea una propuesta de alta en el inventario (cola de revisión). Al aprobarla, el artículo entra en stock y queda enlazado a la factura. Desactivado por defecto.
            </div>
          </div>
        </label>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
