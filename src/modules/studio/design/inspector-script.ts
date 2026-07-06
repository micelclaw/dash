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

// ─── Design canvas — inspector script (OURS, injected with a nonce) ──
//
// The ONLY script inside the canvas iframe (the page HTML is sanitized
// server-side; the CSP allows script-src 'nonce-…' only). It:
//   1. numbers every element under <body> with data-claw-id in PRE-ORDER
//      (querySelectorAll('*') document order) — the parent reproduces the
//      SAME numbering with DOMParser, so both sides talk element ids, no
//      fragile selectors;
//   2. paints a hover overlay + click-select;
//   3. supports inline text editing (contenteditable on demand);
//   4. talks to the parent EXCLUSIVELY via postMessage carrying the
//      per-mount NONCE (parent validates event.source + nonce).

export interface SelectedElementMsg {
  t: 'claw-design:selected';
  nonce: string;
  claw_id: number;
  tag: string;
  path: string;
  outer_html: string;
  text: string;
}

export interface TextEditedMsg {
  t: 'claw-design:text-edited';
  nonce: string;
  claw_id: number;
  new_text: string;
}

/** Build the inspector script body. `nonce` is embedded so messages from
 *  anything else are ignored by the parent. */
export function buildInspectorScript(nonce: string): string {
  return `
(function () {
  var NONCE = ${JSON.stringify(nonce)};
  var els = document.body.querySelectorAll('*');
  for (var i = 0; i < els.length; i++) els[i].setAttribute('data-claw-id', String(i));

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;border:1.5px solid #f59e0b;background:rgba(245,158,11,0.08);border-radius:3px;display:none;transition:all .04s linear;';
  var label = document.createElement('div');
  label.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;background:#f59e0b;color:#000;font:11px ui-monospace,monospace;padding:1px 6px;border-radius:3px;display:none;';
  document.body.appendChild(overlay);
  document.body.appendChild(label);

  var selected = null;

  function place(el) {
    var r = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.left = r.left + 'px';
    overlay.style.top = r.top + 'px';
    overlay.style.width = r.width + 'px';
    overlay.style.height = r.height + 'px';
    label.style.display = 'block';
    label.style.left = r.left + 'px';
    label.style.top = Math.max(0, r.top - 18) + 'px';
    var cls = (typeof el.className === 'string' && el.className) ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    label.textContent = el.tagName.toLowerCase() + cls;
  }

  function pathOf(el) {
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body && parts.length < 8) {
      var idx = 1, sib = cur;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === cur.tagName) idx++;
      parts.unshift(cur.tagName.toLowerCase() + ':nth-of-type(' + idx + ')');
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  document.addEventListener('mousemove', function (e) {
    var el = e.target;
    if (!el || el === overlay || el === label || el === document.body || el === document.documentElement) {
      overlay.style.display = 'none'; label.style.display = 'none'; return;
    }
    if (selected && el === selected) return;
    place(el);
  }, true);

  document.addEventListener('mouseleave', function () {
    if (!selected) { overlay.style.display = 'none'; label.style.display = 'none'; }
  });

  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || el === document.body || el === document.documentElement) return;
    // Kill page navigation/submit — the canvas is a design surface.
    e.preventDefault();
    e.stopPropagation();
    if (el.isContentEditable) return; // typing inside an active text edit
    selected = el;
    place(el);
    parent.postMessage({
      t: 'claw-design:selected',
      nonce: NONCE,
      claw_id: parseInt(el.getAttribute('data-claw-id') || '-1', 10),
      tag: el.tagName.toLowerCase(),
      path: pathOf(el),
      outer_html: (el.outerHTML || '').slice(0, 4096),
      text: (el.textContent || '').slice(0, 400),
    }, '*');
  }, true);

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.nonce !== NONCE) return;
    if (d.t === 'claw-design:edit-text') {
      var el = document.querySelector('[data-claw-id="' + Number(d.claw_id) + '"]');
      if (!el) return;
      el.setAttribute('contenteditable', 'true');
      el.focus();
      var done = false;
      var finish = function () {
        if (done) return; done = true;
        el.removeAttribute('contenteditable');
        parent.postMessage({
          t: 'claw-design:text-edited',
          nonce: NONCE,
          claw_id: Number(d.claw_id),
          new_text: el.textContent || '',
        }, '*');
      };
      el.addEventListener('blur', finish, { once: true });
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); el.blur(); }
        if (ev.key === 'Escape') { ev.preventDefault(); done = true; el.removeAttribute('contenteditable'); }
      });
    }
    if (d.t === 'claw-design:clear-selection') {
      selected = null;
      overlay.style.display = 'none';
      label.style.display = 'none';
    }
  });

  parent.postMessage({ t: 'claw-design:ready', nonce: NONCE }, '*');
})();
`.trim();
}
