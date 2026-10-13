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

// O6.5 — Rendimiento del empresario (EBITDA / EBIT). Disposición A "Cuadro de
// mando": fila de KPIs (EBITDA / EBIT / Bº neto / Margen) · cascada "cómo se
// forma tu beneficio" (Ingresos → EBITDA → EBIT → Bº neto) · dos columnas
// (¿Dónde gano? = ingreso operativo por categoría · Optimización = números
// honestos: escudo fiscal de la amortización, IVA a liquidar, retenciones 473 a
// recuperar, gastos deducibles). Consume GET /finance/reports/operating-result
// con el periodo compartido (PeriodControl del header de la lente).
// Molde visual = FacturacionResumenTab (mismos tokens, sin jerga gratuita).

import { useEffect, useState } from 'react';
import { TrendingUp, Info } from 'lucide-react';
import { api } from '@/services/api';
import { useFinancePeriod } from '../period';
import { fmtMoney } from '../lib/format';
import { Tip } from '../lib/glossary';

// ─── Tipo del backend (envelope { data }) ──────────────────────────────
interface OperatingResult {
  from: string; to: string;
  operating_income: string; operating_expenses: string;
  ebitda: string; ebitda_margin: string;
  depreciation_amortization: string; ebit: string; ebit_margin: string;
  depreciation_material: string; amortization_intangible: string;
  financial_result: string; extraordinary_result: string;
  profit_before_tax: string; corporate_tax: string; net_result: string;
  income_breakdown: Array<{ name: string; amount: string }>;
  optimization: { da_period: string; tax_shield: string; vat_to_settle: string; retentions_recoverable: string; deductible_expenses: string };
}

// ─── Helpers locales (fmtMoney = SSOT en ../lib/format) ─────────────────
const num = (v: string | number | null | undefined) => Number(v ?? 0);

// Paleta de la cascada por tipo de fila.
const C_IN = 'var(--amber)';        // ingresos
const C_OUT = 'var(--error)';       // restas (gastos / amort / impuestos)
const C_EBITDA = 'var(--mod-finance)';
const C_EBIT = 'var(--info)';
const C_NET_POS = 'var(--mod-finance)';
const C_NET_NEG = 'var(--error)';

// KPI grande (molde = Kpi de ResumenTab): barra superior tintada + cifra en color.
// `tip` = clave del glosario → icono de ayuda junto al label (jerga para no-contables).
function Kpi({ label, value, hint, accent, muted, emoji, tip }: { label: string; value: string; hint?: string; accent?: string; muted?: boolean; emoji?: string; tip?: string }) {
  const c = !accent || muted ? 'var(--text)' : accent;
  const barColor = !accent || muted ? 'var(--border)' : accent;
  return (
    <div style={{ flex: 1, minWidth: 150, background: 'var(--card)', border: '1px solid var(--border)', borderTop: `3px solid ${barColor}`, borderRadius: 'var(--radius-md, 6px)', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}>
        {emoji && <span style={{ fontSize: 13 }}>{emoji}</span>}{label}{tip && <Tip k={tip} />}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: c, fontFamily: 'var(--font-mono, monospace)', marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function Card({ title, subtitle, children, flex }: { title: string; subtitle?: string; children: React.ReactNode; flex: string }) {
  return (
    <div style={{ flex, minWidth: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 6px)', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

// ─── Cascada del resultado (waterfall horizontal) ──────────────────────
type CascadeKind = 'in' | 'out' | 'subtotal' | 'final';
interface CascadeRow { label: string; value: number; sign: '' | '+' | '−' | '='; kind: CascadeKind; color: string; }

function CascadeChart({ rows }: { rows: CascadeRow[] }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {rows.map((r, i) => {
        const w = (Math.abs(r.value) / max) * 100;
        const strong = r.kind === 'final' || r.kind === 'subtotal';
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 110px', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: r.kind === 'final' ? 13 : 12, fontWeight: strong ? 700 : 500, color: strong ? 'var(--text)' : 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ color: 'var(--text-muted)', marginRight: 5, fontFamily: 'var(--font-mono, monospace)' }}>{r.sign}</span>{r.label}
            </div>
            <div style={{ position: 'relative', height: strong ? 16 : 12, borderRadius: 4, background: 'var(--surface-hover)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${w}%`, minWidth: 2, background: r.color, opacity: r.kind === 'out' ? 0.85 : 1, borderRadius: 4 }} />
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', fontSize: r.kind === 'final' ? 14 : 12.5, fontWeight: strong ? 700 : 500, color: r.kind === 'final' ? r.color : 'var(--text)' }}>
              {fmtMoney(r.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ¿Dónde gano? (ingreso operativo por categoría) ────────────────────
const SOURCE_COLORS = ['var(--mod-finance)', 'var(--info)', 'var(--amber)', 'var(--warning)', '#a855f7', '#06b6d4', '#ec4899'];

function IncomeSources({ rows }: { rows: Array<{ name: string; amount: string }> }) {
  const total = rows.reduce((s, r) => s + num(r.amount), 0);
  if (rows.length === 0 || total <= 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No operating income in this period yet.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Barra apilada con la mezcla de fuentes */}
      <div style={{ display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-hover)' }}>
        {rows.map((r, i) => {
          const pct = (num(r.amount) / total) * 100;
          if (pct <= 0) return null;
          return <div key={i} title={`${r.name}: ${fmtMoney(r.amount)}`} style={{ width: `${pct}%`, background: SOURCE_COLORS[i % SOURCE_COLORS.length], minWidth: 2 }} />;
        })}
      </div>
      {/* Filas: categoría · % · importe */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((r, i) => {
          const pct = total > 0 ? Math.round((num(r.amount) / total) * 100) : 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0' }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: SOURCE_COLORS[i % SOURCE_COLORS.length], display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{r.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{pct}%</span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)', minWidth: 86, textAlign: 'right' }}>{fmtMoney(r.amount)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Optimización (números honestos) ───────────────────────────────────
function OptimRow({ label, value, note, accent }: { label: string; value: string; note: string; accent?: string }) {
  return (
    <div style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 14, fontWeight: 600, color: accent ?? 'var(--text)' }}>{value}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{note}</div>
    </div>
  );
}

// ─── Componente ────────────────────────────────────────────────────────
export function FacturacionRendimientoTab() {
  const { range, title } = useFinancePeriod();
  const [data, setData] = useState<OperatingResult | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(false);
    void api.get<{ data: OperatingResult }>('/finance/reports/operating-result', { from: range.from, to: range.to })
      .then((r) => { if (alive) { setData(r.data); setLoading(false); } })
      .catch(() => { if (alive) { setData(null); setError(true); setLoading(false); } });
    return () => { alive = false; };
  }, [range.from, range.to]);

  if (loading) {
    return <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>Loading performance…</div>;
  }
  if (error || !data) {
    return <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>Couldn't work out the result for this period.</div>;
  }

  const ebitda = num(data.ebitda), ebit = num(data.ebit), net = num(data.net_result);
  const finRes = num(data.financial_result), extraRes = num(data.extraordinary_result);

  // Cascada: SIEMPRE reconcilia (EBIT + fin + extra − impuestos = Bº neto). Las
  // filas financiera/extraordinaria solo aparecen si son != 0 (demo limpio).
  // La "D" de EBITDA (D&A) se desglosa en material (depreciación) e intangible
  // (amortización) cuando hay ambas; si solo hay una, una línea "Amortizaciones".
  const daMat = num(data.depreciation_material), daInt = num(data.amortization_intangible);
  const cascade: CascadeRow[] = [
    { label: 'Operating income', value: num(data.operating_income), sign: '', kind: 'in', color: C_IN },
    { label: 'Operating expenses', value: num(data.operating_expenses), sign: '−', kind: 'out', color: C_OUT },
    { label: 'EBITDA', value: ebitda, sign: '=', kind: 'subtotal', color: C_EBITDA },
  ];
  if (daMat > 0.005 && daInt > 0.005) {
    cascade.push({ label: 'Depreciation of tangible assets', value: daMat, sign: '−', kind: 'out', color: 'var(--warning)' });
    cascade.push({ label: 'Amortisation of intangible assets', value: daInt, sign: '−', kind: 'out', color: 'var(--warning)' });
  } else {
    cascade.push({ label: 'Amortizaciones', value: num(data.depreciation_amortization), sign: '−', kind: 'out', color: 'var(--warning)' });
  }
  cascade.push({ label: 'EBIT', value: ebit, sign: '=', kind: 'subtotal', color: C_EBIT });
  if (Math.abs(finRes) > 0.005) cascade.push({ label: 'Resultado financiero', value: finRes, sign: finRes >= 0 ? '+' : '−', kind: finRes >= 0 ? 'in' : 'out', color: finRes >= 0 ? C_IN : C_OUT });
  if (Math.abs(extraRes) > 0.005) cascade.push({ label: 'Resultado extraordinario', value: extraRes, sign: extraRes >= 0 ? '+' : '−', kind: extraRes >= 0 ? 'in' : 'out', color: extraRes >= 0 ? C_IN : C_OUT });
  cascade.push({ label: 'Corporate tax', value: num(data.corporate_tax), sign: '−', kind: 'out', color: C_OUT });
  cascade.push({ label: 'BENEFICIO NETO', value: net, sign: '=', kind: 'final', color: net >= 0 ? C_NET_POS : C_NET_NEG });

  const opt = data.optimization;
  const vatToSettle = num(opt.vat_to_settle);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      {/* Intro sin jerga: qué estoy viendo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
        <TrendingUp size={15} style={{ color: 'var(--mod-finance)' }} />
        <span>Cuánto gana tu negocio de verdad y dónde, separando el beneficio operativo del ruido contable (amortizaciones e impuestos). · {title}</span>
      </div>

      {/* Fila de KPIs grandes */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Kpi label="EBITDA" emoji="⚙️" value={fmtMoney(ebitda)} hint="beneficio operativo" accent={C_EBITDA} muted={ebitda <= 0} tip="ebitda" />
        <Kpi label="EBIT" emoji="🔧" value={fmtMoney(ebit)} hint="tras amortizaciones" accent={C_EBIT} muted={ebit <= 0} tip="ebit" />
        <Kpi label="Beneficio neto" emoji="💰" value={fmtMoney(net)} hint="tras impuestos" accent={net >= 0 ? C_NET_POS : C_NET_NEG} />
        <Kpi label="Margen EBITDA" emoji="📊" value={`${data.ebitda_margin} %`} hint="EBITDA / ingresos" accent="var(--amber)" muted={ebitda <= 0} />
      </div>

      {/* Cascada del resultado */}
      <Card title="How your profit is made up" subtitle={title} flex="1 1 100%">
        <CascadeChart rows={cascade} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
          La <strong>depreciation</strong> (la "D&amp;A" de EBITDA) reparte el coste de tus activos: la
          <em> material</em> es el desgaste de equipos e inmovilizado (lo que en inglés se llama
          <em> depreciation</em>); la <em>intangible</em>, el de software/web/licencias
          (<em>amortization</em>) — en el PGC español ambas son "depreciation". La <strong>Seguridad
          Social</strong> de la empresa NO es un impuesto: es coste de personal (junto a los sueldos)
          y por eso va en los <em>operating expenses</em>, dentro del EBITDA.
        </div>
      </Card>

      {/* Dos columnas: ¿Dónde gano? | Optimización */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <Card title="Where do I make money?" subtitle="operating income by category" flex="1 1 360px">
          <IncomeSources rows={data.income_breakdown} />
        </Card>

        <Card title="Optimisation" subtitle="honest numbers" flex="1 1 360px">
          <OptimRow
            label="Depreciation for the period"
            value={fmtMoney(opt.da_period)}
            note={`Escudo fiscal estimado ${fmtMoney(opt.tax_shield)} (al tipo general del IS, 25 %). Amortizar reparte el coste de tus activos y reduce la base imponible.`}
            accent="var(--warning)"
          />
          <OptimRow
            label={vatToSettle >= 0 ? 'VAT to settle (303)' : 'VAT in your favour (303)'}
            value={fmtMoney(Math.abs(vatToSettle))}
            note={vatToSettle >= 0 ? 'What you\'ll pay the tax office this period: VAT charged − VAT paid.' : 'Refundable balance: you have paid more VAT than you have charged.'}
            accent={vatToSettle >= 0 ? 'var(--error)' : 'var(--mod-finance)'}
          />
          <OptimRow
            label="Retenciones a recuperar (473)"
            value={fmtMoney(opt.retentions_recoverable)}
            note="IRPF que tus clientes te han retenido y descuentas de tu próxima declaración."
            accent="var(--info)"
          />
          <OptimRow
            label="Gastos deducibles"
            value={fmtMoney(opt.deductible_expenses)}
            note="Gasto operativo del periodo que reduce tu beneficio antes de impuestos. Cada factura bien registrada baja tu base imponible."
          />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Cifras calculadas sobre tus asientos reales. El ahorro fiscal es una estimación al tipo general; tu tipo efectivo puede variar. No es asesoramiento fiscal.</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
