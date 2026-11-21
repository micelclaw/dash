/** Presentation adapter for our four installed Office wrappers, never arbitrary apps.
 * Native editor menus retain save/share/agent; exceptional recovery stays visible.
 * Standalone app UIs and immutable packages keep their original source offer. */
export function compactOfficeChrome(doc: Document, app: string) {
  if (!['documents', 'spreadsheets', 'presentations', 'pdf'].includes(app)) return;
  const header = doc.querySelector<HTMLElement>('.mc-header');
  if (!header) return;
  const style = doc.createElement('style');
  style.dataset.micelclawOfficeChrome = 'compact';
  style.textContent = `
    html[data-office-compact] .mc-header { display:none !important; }
    html[data-office-compact] body > #app { height:100dvh !important; }
    html[data-office-compact][data-office-attention] .mc-header,
    html[data-office-compact] .mc-header[data-office-recovery] { display:flex !important; }
    html[data-office-compact][data-office-attention] body:has(> .mc-header) > #app,
    html[data-office-compact] body:has(> .mc-header[data-office-recovery]) > #app { height:calc(100dvh - 40px) !important; }
    [data-office-floating-space] { padding-inline-end:80px !important; box-sizing:border-box; }
  `;
  doc.head.append(style);
  doc.documentElement.setAttribute('data-office-compact', '');
  let stateAttention = false;
  let reserved: HTMLElement | null = null;
  const refresh = (attention = stateAttention) => {
    stateAttention = attention;
    doc.documentElement.toggleAttribute('data-office-attention', attention || !!doc.querySelector('.mc-error:not([hidden]), .mc-boot-error:not([hidden])'));
    // Each current wrapper has seven standard buttons. Extra durable recovery
    // actions are added to this same header; do not hide them with the duplicates.
    header.toggleAttribute('data-office-recovery', header.querySelectorAll('button').length > 7);
    if (!reserved) {
      let row = doc.querySelector<HTMLElement>('[role="menubar"]')?.parentElement;
      while (row && row !== doc.body) {
        const box = row.getBoundingClientRect();
        if (box.width >= doc.documentElement.clientWidth * .85 && box.height > 0 && box.height < 120) {
          reserved = row; row.setAttribute('data-office-floating-space', ''); break;
        }
        row = row.parentElement;
      }
    }
  };
  const observer = new MutationObserver(() => refresh());
  observer.observe(header, {childList: true});
  for (const error of doc.querySelectorAll('.mc-error, .mc-boot-error')) observer.observe(error, {attributes: true, attributeFilter: ['hidden']});
  refresh();
  return {refresh, destroy() {observer.disconnect();style.remove();doc.documentElement.removeAttribute('data-office-compact');doc.documentElement.removeAttribute('data-office-attention');header.removeAttribute('data-office-recovery');reserved?.removeAttribute('data-office-floating-space');}};
}
