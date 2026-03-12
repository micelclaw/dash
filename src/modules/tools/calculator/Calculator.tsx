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

import { useState, useCallback, useEffect } from 'react';
import { evaluate } from 'mathjs';

type AngleMode = 'deg' | 'rad';

const HISTORY_MAX = 50;

export function Calculator() {
  const [expression, setExpression] = useState('');
  const [display, setDisplay] = useState('0');
  const [angleMode, setAngleMode] = useState<AngleMode>('deg');
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useState<{ expr: string; result: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const append = useCallback((val: string) => {
    setExpression(prev => {
      if (prev === '' && display !== '0' && display !== 'Error') {
        // Continue from previous result
        return display + val;
      }
      return prev + val;
    });
    setDisplay(prev => {
      if (prev === '0' && val !== '.') return val;
      if (prev === 'Error') return val;
      return '';
    });
  }, [display]);

  const clear = useCallback(() => {
    setExpression('');
    setDisplay('0');
  }, []);

  const backspace = useCallback(() => {
    setExpression(prev => {
      const next = prev.slice(0, -1);
      if (!next) { setDisplay('0'); return ''; }
      return next;
    });
  }, []);

  const calc = useCallback(() => {
    if (!expression) return;
    try {
      let expr = expression;
      // Degree mode: wrap trig functions
      if (angleMode === 'deg') {
        expr = expr.replace(/sin\(([^)]+)\)/g, 'sin($1 deg)');
        expr = expr.replace(/cos\(([^)]+)\)/g, 'cos($1 deg)');
        expr = expr.replace(/tan\(([^)]+)\)/g, 'tan($1 deg)');
      }
      const result = evaluate(expr);
      const resultStr = typeof result === 'number'
        ? Number.isInteger(result) ? result.toString() : parseFloat(result.toPrecision(12)).toString()
        : String(result);
      setDisplay(resultStr);
      setHistory(prev => [{ expr: expression, result: resultStr }, ...prev].slice(0, HISTORY_MAX));
      setExpression('');
    } catch {
      setDisplay('Error');
      setExpression('');
    }
  }, [expression, angleMode]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture if focus is on an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key;
      if (/^[0-9.]$/.test(key)) { append(key); e.preventDefault(); }
      else if (key === '+' || key === '-') { append(` ${key} `); e.preventDefault(); }
      else if (key === '*') { append(' * '); e.preventDefault(); }
      else if (key === '/') { append(' / '); e.preventDefault(); }
      else if (key === '(' || key === ')') { append(key); e.preventDefault(); }
      else if (key === '%') { append('%'); e.preventDefault(); }
      else if (key === 'Enter') { calc(); e.preventDefault(); }
      else if (key === 'Escape') { clear(); e.preventDefault(); }
      else if (key === 'Backspace') { backspace(); e.preventDefault(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [append, calc, clear, backspace]);

  const memoryAdd = () => { const v = parseFloat(display); if (!isNaN(v)) setMemory(prev => prev + v); };
  const memorySub = () => { const v = parseFloat(display); if (!isNaN(v)) setMemory(prev => prev - v); };
  const memoryRecall = () => { if (memory !== 0) { setExpression(prev => prev + memory.toString()); setDisplay(''); } };

  const btnStyle = (color?: string, bg?: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', borderRadius: 'var(--radius-sm)',
    cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
    fontFamily: 'var(--font-mono)',
    background: bg || 'var(--surface)',
    color: color || 'var(--text)',
    transition: 'background var(--transition-fast)',
    padding: '6px 0',
  });

  const sciBtn = (label: string, fn: string) => (
    <button style={btnStyle('var(--mod-tools)')} onClick={() => append(`${fn}(`)}>
      {label}
    </button>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: 8, gap: 6, fontFamily: 'var(--font-sans)',
    }}>
      {/* Display */}
      <div style={{
        background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
        padding: '8px 10px', minHeight: 56,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end',
      }}>
        <div style={{
          fontSize: '0.6875rem', color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)', wordBreak: 'break-all',
          minHeight: 16, textAlign: 'right',
        }}>
          {expression || '\u00A0'}
        </div>
        <div style={{
          fontSize: '1.5rem', fontWeight: 600,
          fontFamily: 'var(--font-mono)', color: 'var(--text)',
          textAlign: 'right', wordBreak: 'break-all',
        }}>
          {display}
        </div>
      </div>

      {/* Top controls */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          style={{ ...btnStyle(angleMode === 'deg' ? 'var(--amber)' : 'var(--text-dim)'), flex: 1, fontSize: '0.6875rem' }}
          onClick={() => setAngleMode(m => m === 'deg' ? 'rad' : 'deg')}
        >
          {angleMode === 'deg' ? 'DEG' : 'RAD'}
        </button>
        <button
          style={{ ...btnStyle('var(--text-dim)'), flex: 1, fontSize: '0.6875rem', position: 'relative' }}
          onClick={() => setShowHistory(!showHistory)}
        >
          History ▾
        </button>
      </div>

      {/* History dropdown */}
      {showHistory && (
        <div style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: 6,
          maxHeight: 120, overflowY: 'auto', fontSize: '0.6875rem',
        }}>
          {history.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 8 }}>No history</div>
          ) : history.map((h, i) => (
            <div
              key={i}
              onClick={() => { setExpression(h.expr); setDisplay(h.result); setShowHistory(false); }}
              style={{
                display: 'flex', justifyContent: 'space-between', padding: '3px 4px',
                cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span style={{ color: 'var(--text-dim)' }}>{h.expr}</span>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>= {h.result}</span>
            </div>
          ))}
        </div>
      )}

      {/* Button grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, flex: 1 }}>
        {/* Scientific row */}
        {sciBtn('sin', 'sin')}
        {sciBtn('cos', 'cos')}
        {sciBtn('tan', 'tan')}
        {sciBtn('log', 'log10')}
        {sciBtn('ln', 'log')}

        {/* Power row */}
        <button style={btnStyle('var(--mod-tools)')} onClick={() => append('^2')}>x²</button>
        <button style={btnStyle('var(--mod-tools)')} onClick={() => append('sqrt(')}>√</button>
        <button style={btnStyle('var(--mod-tools)')} onClick={() => append('pi')}>π</button>
        <button style={btnStyle('var(--mod-tools)')} onClick={() => append('e')}>e</button>
        <button style={btnStyle('var(--mod-tools)')} onClick={() => append('!')}>!</button>

        {/* Utility row */}
        <button style={btnStyle()} onClick={() => append('(')}>(</button>
        <button style={btnStyle()} onClick={() => append(')')}>)</button>
        <button style={btnStyle()} onClick={() => append('%')}>%</button>
        <button style={btnStyle('#ef4444')} onClick={clear}>C</button>
        <button style={btnStyle()} onClick={backspace}>⌫</button>

        {/* Numeric grid row 1 */}
        <button style={btnStyle()} onClick={() => append('7')}>7</button>
        <button style={btnStyle()} onClick={() => append('8')}>8</button>
        <button style={btnStyle()} onClick={() => append('9')}>9</button>
        <button style={btnStyle('var(--amber)')} onClick={() => append(' / ')}>÷</button>
        <button style={btnStyle('var(--text-dim)', 'transparent')} onClick={memoryAdd}>M+</button>

        {/* Numeric grid row 2 */}
        <button style={btnStyle()} onClick={() => append('4')}>4</button>
        <button style={btnStyle()} onClick={() => append('5')}>5</button>
        <button style={btnStyle()} onClick={() => append('6')}>6</button>
        <button style={btnStyle('var(--amber)')} onClick={() => append(' * ')}>×</button>
        <button style={btnStyle('var(--text-dim)', 'transparent')} onClick={memorySub}>M−</button>

        {/* Numeric grid row 3 */}
        <button style={btnStyle()} onClick={() => append('1')}>1</button>
        <button style={btnStyle()} onClick={() => append('2')}>2</button>
        <button style={btnStyle()} onClick={() => append('3')}>3</button>
        <button style={btnStyle('var(--amber)')} onClick={() => append(' - ')}>−</button>
        <button style={btnStyle('var(--text-dim)', 'transparent')} onClick={memoryRecall}>MR</button>

        {/* Numeric grid row 4 */}
        <button style={btnStyle()} onClick={() => append('0')}>0</button>
        <button style={btnStyle()} onClick={() => append('.')}>.</button>
        <button style={btnStyle()} onClick={() => append('e')}>EXP</button>
        <button style={btnStyle('var(--amber)')} onClick={() => append(' + ')}>+</button>
        <button style={btnStyle('#000', 'var(--amber)')} onClick={calc}>=</button>
      </div>
    </div>
  );
}
