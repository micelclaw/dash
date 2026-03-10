// ─── Shared CSS for all crypto setup wizards ────────────────────────
// Extracted from BtcSetupWizard. Import and render as <style>{WIZARD_STYLES}</style>

export const WIZARD_STYLES = `
  .wizard-section-title { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .wizard-radio { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: var(--surface); border-radius: var(--radius-sm); cursor: pointer; transition: border-color 0.15s; }
  .wizard-radio:hover { border-color: var(--text-muted) !important; }
  .wizard-radio-label { font-size: 0.8125rem; font-weight: 500; color: var(--text); }
  .wizard-radio-desc { font-size: 0.6875rem; color: var(--text-muted); margin-top: 2px; }
  .wizard-radio-eta { font-size: 0.625rem; color: var(--text-muted); background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 3px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .wizard-field-label { font-size: 0.6875rem; color: var(--text-muted); margin-bottom: 4px; }
  .wizard-select { width: 100%; padding: 6px 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 0.8125rem; font-family: var(--font-sans); outline: none; cursor: pointer; }
  .wizard-select:focus { border-color: var(--amber); }
  .wizard-input { width: 100%; padding: 6px 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 0.8125rem; font-family: var(--font-sans); outline: none; }
  .wizard-input:focus { border-color: var(--amber); }
  .wizard-input::placeholder { color: var(--text-muted); }
  .wizard-toggle { background: none; border: none; color: var(--text-muted); font-size: 0.75rem; font-weight: 500; cursor: pointer; padding: 0; font-family: var(--font-sans); }
  .wizard-toggle:hover { color: var(--text); }
  .wizard-advanced-box { margin-top: 8px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 10px; }
  .wizard-checkbox { display: flex; align-items: flex-start; gap: 8px; cursor: pointer; font-size: 0.8125rem; color: var(--text); }
  .wizard-checkbox input:disabled { opacity: 0.4; cursor: not-allowed; }
  .wizard-checkbox-note { display: block; font-size: 0.6875rem; color: var(--text-muted); }
  .wizard-warning { display: flex; align-items: center; gap: 6px; font-size: 0.6875rem; color: #f59e0b; }
  .wizard-error-banner { display: flex; align-items: center; gap: 6px; font-size: 0.6875rem; color: var(--error, #ef4444); }
  .wizard-info { font-size: 0.6875rem; color: var(--text-muted); font-style: italic; }
  .wizard-confirm-box { padding: 12px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); border-radius: var(--radius-sm); }
  .wizard-dep-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 0.8125rem; color: var(--text); }
  .wizard-dep-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .wizard-dep-label { font-size: 0.6875rem; color: var(--text-muted); margin-left: auto; }
  .wizard-btn-secondary { flex: 1; padding: 8px 12px; background: none; border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-dim); cursor: pointer; font-family: var(--font-sans); font-size: 0.8125rem; }
  .wizard-btn-secondary:hover { background: var(--surface-hover); }
  .wizard-btn-primary { flex: 1; padding: 8px 12px; background: var(--amber); border: none; border-radius: var(--radius-md); color: #000; cursor: pointer; font-weight: 600; font-family: var(--font-sans); font-size: 0.8125rem; }
  .wizard-btn-primary:hover { filter: brightness(1.1); }
  .wizard-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; filter: none; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
