import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUpDown } from 'lucide-react';

/* ── Category definitions ── */
interface UnitDef { id: string; label: string; toBase: (v: number) => number; fromBase: (v: number) => number }

const length: UnitDef[] = [
  { id: 'mm', label: 'mm', toBase: v => v / 1000, fromBase: v => v * 1000 },
  { id: 'cm', label: 'cm', toBase: v => v / 100, fromBase: v => v * 100 },
  { id: 'm',  label: 'm',  toBase: v => v,        fromBase: v => v },
  { id: 'km', label: 'km', toBase: v => v * 1000,  fromBase: v => v / 1000 },
  { id: 'in', label: 'in', toBase: v => v * 0.0254, fromBase: v => v / 0.0254 },
  { id: 'ft', label: 'ft', toBase: v => v * 0.3048, fromBase: v => v / 0.3048 },
  { id: 'yd', label: 'yd', toBase: v => v * 0.9144, fromBase: v => v / 0.9144 },
  { id: 'mi', label: 'mi', toBase: v => v * 1609.344, fromBase: v => v / 1609.344 },
];

const mass: UnitDef[] = [
  { id: 'mg', label: 'mg', toBase: v => v / 1e6, fromBase: v => v * 1e6 },
  { id: 'g',  label: 'g',  toBase: v => v / 1000, fromBase: v => v * 1000 },
  { id: 'kg', label: 'kg', toBase: v => v,         fromBase: v => v },
  { id: 'oz', label: 'oz', toBase: v => v * 0.0283495, fromBase: v => v / 0.0283495 },
  { id: 'lb', label: 'lb', toBase: v => v * 0.453592, fromBase: v => v / 0.453592 },
  { id: 'ton', label: 'ton', toBase: v => v * 1000, fromBase: v => v / 1000 },
];

const temp: UnitDef[] = [
  { id: 'C', label: '°C', toBase: v => v, fromBase: v => v },
  { id: 'F', label: '°F', toBase: v => (v - 32) * 5 / 9, fromBase: v => v * 9 / 5 + 32 },
  { id: 'K', label: 'K',  toBase: v => v - 273.15, fromBase: v => v + 273.15 },
];

const volume: UnitDef[] = [
  { id: 'ml', label: 'ml', toBase: v => v / 1000, fromBase: v => v * 1000 },
  { id: 'l',  label: 'L',  toBase: v => v,        fromBase: v => v },
  { id: 'gal', label: 'gal', toBase: v => v * 3.78541, fromBase: v => v / 3.78541 },
  { id: 'qt', label: 'qt', toBase: v => v * 0.946353, fromBase: v => v / 0.946353 },
  { id: 'cup', label: 'cup', toBase: v => v * 0.236588, fromBase: v => v / 0.236588 },
  { id: 'floz', label: 'fl oz', toBase: v => v * 0.0295735, fromBase: v => v / 0.0295735 },
];

const speed: UnitDef[] = [
  { id: 'ms', label: 'm/s', toBase: v => v, fromBase: v => v },
  { id: 'kmh', label: 'km/h', toBase: v => v / 3.6, fromBase: v => v * 3.6 },
  { id: 'mph', label: 'mph', toBase: v => v * 0.44704, fromBase: v => v / 0.44704 },
  { id: 'kn', label: 'knots', toBase: v => v * 0.514444, fromBase: v => v / 0.514444 },
];

const data: UnitDef[] = [
  { id: 'B', label: 'B', toBase: v => v, fromBase: v => v },
  { id: 'KB', label: 'KB', toBase: v => v * 1024, fromBase: v => v / 1024 },
  { id: 'MB', label: 'MB', toBase: v => v * 1048576, fromBase: v => v / 1048576 },
  { id: 'GB', label: 'GB', toBase: v => v * 1073741824, fromBase: v => v / 1073741824 },
  { id: 'TB', label: 'TB', toBase: v => v * 1099511627776, fromBase: v => v / 1099511627776 },
];

const CATEGORIES: { id: string; label: string; units: UnitDef[] }[] = [
  { id: 'length', label: 'Length', units: length },
  { id: 'mass', label: 'Mass', units: mass },
  { id: 'temp', label: 'Temp', units: temp },
  { id: 'volume', label: 'Volume', units: volume },
  { id: 'speed', label: 'Speed', units: speed },
  { id: 'data', label: 'Data', units: data },
  { id: 'currency', label: 'Currency', units: [] }, // dynamic
];

/* ── Currency ── */
const FALLBACK_RATES: Record<string, number> = {
  EUR: 1, USD: 1.08, GBP: 0.86, JPY: 162, CHF: 0.95, CAD: 1.47, AUD: 1.66, CNY: 7.8, MXN: 18.5, BRL: 5.4,
};
const CURRENCY_CACHE_KEY = 'converter-exchange-rates';
const CURRENCY_TTL = 24 * 60 * 60 * 1000;

function getCurrencyUnits(rates: Record<string, number>): UnitDef[] {
  return Object.keys(rates).map(code => ({
    id: code, label: code,
    toBase: (v: number) => v / rates[code],     // to EUR
    fromBase: (v: number) => v * rates[code],   // from EUR
  }));
}

export function Converter() {
  const [catIdx, setCatIdx] = useState(0);
  const [value, setValue] = useState('1');
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const fetchedRef = useRef(false);

  // Fetch currency rates
  useEffect(() => {
    if (CATEGORIES[catIdx].id !== 'currency' || fetchedRef.current) return;
    fetchedRef.current = true;

    const cached = sessionStorage.getItem(CURRENCY_CACHE_KEY);
    if (cached) {
      try {
        const { rates, ts } = JSON.parse(cached);
        if (Date.now() - ts < CURRENCY_TTL) { setCurrencyRates(rates); return; }
      } catch { /* ignore */ }
    }

    fetch('https://api.frankfurter.app/latest?from=EUR')
      .then(r => r.json())
      .then(data => {
        const rates = { EUR: 1, ...data.rates };
        setCurrencyRates(rates);
        sessionStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify({ rates, ts: Date.now() }));
      })
      .catch(() => { /* use fallback */ });
  }, [catIdx]);

  const cat = CATEGORIES[catIdx];
  const units = cat.id === 'currency' ? getCurrencyUnits(currencyRates) : cat.units;

  // Reset indices when category changes
  const handleCatChange = useCallback((idx: number) => {
    setCatIdx(idx);
    setFromIdx(0);
    setToIdx(1);
    setValue('1');
  }, []);

  const swap = useCallback(() => {
    setFromIdx(toIdx);
    setToIdx(fromIdx);
  }, [fromIdx, toIdx]);

  const numVal = parseFloat(value) || 0;
  const from = units[fromIdx] || units[0];
  const to = units[toIdx] || units[1];
  const result = from && to ? to.fromBase(from.toBase(numVal)) : 0;

  const formatResult = (v: number) => {
    if (Math.abs(v) < 0.001 && v !== 0) return v.toExponential(4);
    return parseFloat(v.toPrecision(10)).toLocaleString('en-US', { maximumFractionDigits: 6 });
  };

  const selectStyle: React.CSSProperties = {
    flex: 1, background: 'var(--surface)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    padding: '6px 8px', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
    cursor: 'pointer', outline: 'none',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: 10, gap: 10, fontFamily: 'var(--font-sans)',
    }}>
      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 2, overflowX: 'auto', flexShrink: 0,
        paddingBottom: 2,
      }}>
        {CATEGORIES.map((c, i) => (
          <button
            key={c.id}
            onClick={() => handleCatChange(i)}
            style={{
              padding: '4px 8px', fontSize: '0.625rem', fontWeight: 500,
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: i === catIdx ? 'var(--mod-tools)' : 'var(--surface)',
              color: i === catIdx ? '#fff' : 'var(--text-dim)',
              whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* From */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{
            width: '100%', background: 'var(--bg)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            padding: '8px 10px', fontSize: '1.25rem', fontWeight: 600,
            fontFamily: 'var(--font-mono)', textAlign: 'right', outline: 'none',
          }}
        />
        <select value={fromIdx} onChange={e => setFromIdx(Number(e.target.value))} style={selectStyle}>
          {units.map((u, i) => <option key={u.id} value={i}>{u.label}</option>)}
        </select>
      </div>

      {/* Swap button */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={swap}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, border: '1px solid var(--border)',
            borderRadius: '50%', background: 'var(--surface)',
            cursor: 'pointer', color: 'var(--text-dim)',
          }}
        >
          <ArrowUpDown size={14} />
        </button>
      </div>

      {/* To */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          width: '100%', background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          padding: '8px 10px', fontSize: '1.25rem', fontWeight: 600,
          fontFamily: 'var(--font-mono)', textAlign: 'right',
          color: 'var(--amber)', minHeight: 44,
        }}>
          {formatResult(result)}
        </div>
        <select value={toIdx} onChange={e => setToIdx(Number(e.target.value))} style={selectStyle}>
          {units.map((u, i) => <option key={u.id} value={i}>{u.label}</option>)}
        </select>
      </div>

      {/* Quick conversions */}
      <div style={{
        flex: 1, overflowY: 'auto', fontSize: '0.6875rem', color: 'var(--text-dim)',
        fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: 2,
        padding: '4px 0',
      }}>
        {units.filter((_, i) => i !== fromIdx && i !== toIdx).slice(0, 4).map(u => {
          const converted = u.fromBase(from.toBase(numVal));
          return (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{numVal} {from.label}</span>
              <span style={{ color: 'var(--text)' }}>{formatResult(converted)} {u.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
