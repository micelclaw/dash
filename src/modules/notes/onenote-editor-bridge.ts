import DOMPurify from 'dompurify';

export interface OneNoteEditorUnit {
  index: number; id: string;
  inherited_language?: string;
  value: { tag: string; html: string; attributes: Record<string, string> };
}
export interface OneNoteEditorAuthority { enabled: boolean; insert_enabled?: boolean; local_revision: string; units: OneNoteEditorUnit[]; }

/** Read projection -> the existing editor's schema, with native identity kept
 * out of the visible UI. Resource URLs are already same-note blob URLs. */
export function oneNoteEditorHtml(content: string, units: OneNoteEditorUnit[], images: Record<string, string>) {
  const clean = DOMPurify.sanitize(content, { FORBID_TAGS: ['script', 'style', 'iframe', 'svg', 'math', 'form'],
    FORBID_ATTR: ['src', 'srcset'], ALLOW_DATA_ATTR: true });
  const document = new DOMParser().parseFromString(clean, 'text/html');
  const known = new Set(units.map(unit => String(unit.index)));
  for (const image of document.body.querySelectorAll('img[data-note-resource]')) {
    const ref = image.getAttribute('data-note-resource') || '';
    if (images[ref]) image.setAttribute('src', images[ref]);
    else image.setAttribute('alt', 'Imagen de OneNote (cargando)');
  }
  for (const file of document.body.querySelectorAll('[data-note-file][data-note-resource]')) {
    const url = images[file.getAttribute('data-note-resource') || ''];
    if (!url) continue;
    const image = document.createElement('img'); image.src = url; image.alt = file.textContent || 'Imagen adjunta'; file.replaceWith(image);
  }
  // Divs describe the OneNote canvas, not editor blocks. Preserve reading order
  // supplied by Core while giving the regular editor a continuous document.
  for (const div of [...document.body.querySelectorAll('div')].reverse()) div.replaceWith(...div.childNodes);
  let key = 0;
  const protect = (element: Element) => {
    const atom = document.createElement('div'); atom.setAttribute('data-note-protected-key', String(key++));
    atom.append(element); return atom;
  };
  for (const element of [...document.body.children]) {
    const index = element.getAttribute('data-note-unit-index');
    if (index !== null && known.has(index)) continue;
    if (element.matches('ol,ul') && [...element.querySelectorAll('[data-note-unit-index]')].length &&
      [...element.children].every(child => known.has(child.getAttribute('data-note-unit-index') || ''))) continue;
    if (element.matches('ol,ul') && [...element.children].some(child => known.has(child.getAttribute('data-note-unit-index') || ''))) {
      // OneNote embeds attachments directly among list items. Do not make all
      // editable measurements read-only just because one sibling is an image.
      const fragment = document.createDocumentFragment(); let run: Element | null = null;
      let number = Number(element.getAttribute('start') || 1);
      for (const child of [...element.children]) {
        if (known.has(child.getAttribute('data-note-unit-index') || '')) {
          if (!run) { run = element.cloneNode(false) as Element;
            if (run.tagName === 'OL' && number !== 1) run.setAttribute('start', String(number)); fragment.append(run); }
          run.append(child);
        } else { run = null; fragment.append(protect(child)); }
        if (child.tagName === 'LI') number = Number(child.getAttribute('value') || number) + 1;
      }
      element.replaceWith(fragment); continue;
    }
    const atom = protect(element.cloneNode(true) as Element); element.replaceWith(atom);
  }
  // A trailing paragraph provides the ordinary caret/blank-space editing area.
  return `${document.body.innerHTML}<p></p>`;
}

function parse(html: string) { return new DOMParser().parseFromString(html, 'text/html').body; }
function inlineHtml(element: Element, tag: string): string {
  const copy = element.cloneNode(true) as Element;
  for (const child of copy.querySelectorAll('[data-note-unit-index],[data-note-draft-id]')) {
    child.removeAttribute('data-note-unit-index'); child.removeAttribute('data-note-draft-id');
  }
  // TipTap's list schema wraps each item's text in a paragraph. Graph lists
  // accept that form too, but retaining the original simple form avoids churn.
  if (tag === 'li' && copy.children.length === 1 && copy.firstElementChild?.tagName === 'P')
    return copy.firstElementChild.innerHTML;
  return copy.innerHTML;
}
function preserveNativeText(originalHtml: string, beforeHtml: string, afterHtml: string): string | null {
  const original = parse(originalHtml); const before = parse(beforeHtml); const after = parse(afterHtml);
  const shape = (body: HTMLElement) => {
    const copy = body.cloneNode(true) as HTMLElement;
    const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT); let node: Node | null;
    while ((node = walker.nextNode())) node.textContent = '';
    return copy.innerHTML;
  };
  const oldText = before.textContent || ''; const nextText = after.textContent || '';
  if (original.textContent !== oldText || shape(before) !== shape(after)) return null;
  let start = 0; while (start < oldText.length && start < nextText.length && oldText[start] === nextText[start]) start++;
  let suffix = 0; while (suffix < oldText.length - start && suffix < nextText.length - start &&
    oldText[oldText.length - suffix - 1] === nextText[nextText.length - suffix - 1]) suffix++;
  const end = oldText.length - suffix; const replacement = nextText.slice(start, nextText.length - suffix);
  const walker = document.createTreeWalker(original, NodeFilter.SHOW_TEXT); let node: Node | null; let offset = 0; let inserted = false;
  while ((node = walker.nextNode())) {
    const text = node.textContent || ''; const limit = offset + text.length;
    if (limit >= start && offset <= end) {
      const prefix = text.slice(0, Math.max(0, start - offset));
      const tail = text.slice(Math.max(0, end - offset));
      node.textContent = prefix + (!inserted ? replacement : '') + tail; inserted = true;
    }
    offset = limit;
  }
  if (!inserted && replacement) original.append(document.createTextNode(replacement));
  return original.innerHTML;
}

/** Diff against the initial TipTap serialization, never against raw native HTML:
 * merely opening a note must not write parser normalization back to OneNote. */
export function oneNoteEditorChanges(beforeHtml: string, nextHtml: string, authority: OneNoteEditorAuthority) {
  const before = parse(beforeHtml); const next = parse(nextHtml);
  const nativeOrder = (body: HTMLElement) => [...body.querySelectorAll('[data-note-unit-index],[data-note-protected-key]')]
    .map(node => node.hasAttribute('data-note-unit-index') ? `unit:${node.getAttribute('data-note-unit-index')}`
      : `protected:${node.getAttribute('data-note-protected-key')}`);
  if (JSON.stringify(nativeOrder(before)) !== JSON.stringify(nativeOrder(next)))
    throw new Error('Mover texto alrededor de imágenes o dibujos aún no se puede sincronizar. Tu borrador se conserva.');
  const protectedKeys = (body: HTMLElement) => [...body.querySelectorAll('[data-note-protected-key]')]
    .map(node => node.getAttribute('data-note-protected-key'));
  if (JSON.stringify(protectedKeys(before)) !== JSON.stringify(protectedKeys(next)))
    throw new Error('Este cambio afecta a una imagen o dibujo protegido y aún no se puede sincronizar. Tu borrador se conserva.');
  const oldElements = [...before.querySelectorAll('[data-note-unit-index]')];
  const newElements = [...next.querySelectorAll('[data-note-unit-index]')];
  const order = (elements: Element[]) => elements.map(element => element.getAttribute('data-note-unit-index'));
  if (JSON.stringify(order(oldElements)) !== JSON.stringify(order(newElements)))
    throw new Error('Este cambio de estructura aún no se puede sincronizar. Tu borrador se conserva.');
  const newBlocks = [...next.querySelectorAll('[data-note-draft-id]')].filter(element =>
    !element.closest('[data-note-unit-index],[data-note-protected-key]') &&
    !element.parentElement?.closest('[data-note-draft-id]') && (element.textContent?.trim() || element.querySelector('img')));
  if (newBlocks.length && !authority.insert_enabled)
    throw new Error('La inserción de texto nuevo está pendiente de habilitar en OneNote. Tu borrador se conserva.');
  const insertions = newBlocks.map(element => {
    if (!['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'OL', 'UL'].includes(element.tagName) || element.querySelector('img,[data-note-unit-index]'))
      throw new Error('Este contenido nuevo aún no se puede sincronizar en OneNote. Tu borrador se conserva.');
    let previous = element.previousElementSibling; let following = element.nextElementSibling;
    while (previous?.hasAttribute('data-note-draft-id')) previous = previous.previousElementSibling;
    while (following?.hasAttribute('data-note-draft-id')) following = following.nextElementSibling;
    const index = previous?.getAttribute('data-note-unit-index') ?? following?.getAttribute('data-note-unit-index');
    const anchor = authority.units.find(unit => String(unit.index) === index);
    return { op: 'insert_unit' as const, unit_id: element.getAttribute('data-note-draft-id')!, anchor_id: anchor?.id || null,
      position: (previous?.getAttribute('data-note-unit-index') !== null && previous?.hasAttribute('data-note-unit-index') ? 'after'
        : following?.hasAttribute('data-note-unit-index') ? 'before' : 'after') as 'before' | 'after',
      value: { tag: element.tagName.toLowerCase(), html: inlineHtml(element, element.tagName.toLowerCase()), attributes: {} } };
  });
  // No untracked text, formatting or resource may silently disappear on save.
  const untracked = (body: HTMLElement) => {
    const copy = body.cloneNode(true) as HTMLElement;
    for (const node of copy.querySelectorAll('[data-note-unit-index],[data-note-protected-key],[data-note-draft-id]')) node.remove();
    for (const node of [...copy.querySelectorAll('p,ol,ul')].reverse()) if (!node.textContent?.trim() && !node.querySelector('img')) node.remove();
    return copy.innerHTML.trim();
  };
  if (untracked(before) !== untracked(next)) throw new Error('Este cambio de estructura aún no se puede sincronizar. Tu borrador se conserva.');
  const updates = authority.units.flatMap(unit => {
    const selector = `[data-note-unit-index="${unit.index}"]`;
    const oldElement = before.querySelector(selector); const newElement = next.querySelector(selector);
    if (!oldElement || !newElement) return [];
    if (oldElement.outerHTML === newElement.outerHTML) return [];
    if (newElement.tagName.toLowerCase() !== unit.value.tag)
      throw new Error('Este cambio de tipo de párrafo aún no se puede sincronizar. Tu borrador se conserva.');
    const nativeInline = parse(unit.value.html);
    const preserved = preserveNativeText(unit.value.html, inlineHtml(oldElement, unit.value.tag), inlineHtml(newElement, unit.value.tag));
    // TipTap cannot round-trip arbitrary native spans/styles. Do not replace
    // them with a lossy serialization just because the plain text was edited.
    if (preserved === null && (nativeInline.querySelector('span[style],span[class],[data-id],font') ||
      [...nativeInline.querySelectorAll('*')].some(node => [...node.attributes].some(attribute =>
        attribute.name === 'lang' ? attribute.value.toLowerCase() !== (unit.value.attributes.lang || unit.inherited_language || '').toLowerCase()
          : !['href', 'target', 'rel', 'start', 'value', 'type'].includes(attribute.name)))))
      throw new Error('Este texto contiene formato nativo que todavía no podemos conservar al editar. Tu borrador se conserva.');
    return [{ op: 'set_unit' as const, unit_id: unit.id, value: { ...unit.value, html: preserved ?? inlineHtml(newElement, unit.value.tag) } }];
  });
  return [...updates, ...insertions];
}

/** Match the submitted read order to Core's confirmed projection before renewing
 * invisible identities. If Graph rearranges content, preserve the draft instead
 * of guessing a unit or acknowledging the wrong layout. */
export function oneNoteEditorIdentityMap(submittedHtml: string, confirmedContent: string) {
  const submitted = parse(submittedHtml); const confirmed = parse(confirmedContent);
  const source = [...submitted.querySelectorAll('[data-note-unit-index],[data-note-draft-id]')].filter(element =>
    !element.parentElement?.closest('[data-note-unit-index],[data-note-draft-id]') &&
    (element.hasAttribute('data-note-unit-index') || element.textContent?.trim()));
  const target = [...confirmed.querySelectorAll('[data-note-unit-index]')];
  const comparable = (element: Element) => {
    const copy = element.cloneNode(true) as Element;
    const lists = [...(copy.matches('ol,ul') ? [copy] : []), ...copy.querySelectorAll('ol,ul')];
    const numbering = lists.map(list => {
      let next = Number(list.getAttribute('start') || 1);
      const values = [...list.children].filter(child => child.tagName === 'LI').map(child => {
        const value = Number(child.getAttribute('value') || next); next = value + 1;
        return list.tagName === 'OL' ? value : null;
      });
      // Graph's pretty-printed indentation between list items is not note text.
      // Never trim whitespace within paragraphs/items or discard explicit numbers.
      for (const node of [...list.childNodes]) if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) node.remove();
      return [list.tagName, values];
    });
    return JSON.stringify([copy.textContent, numbering]);
  };
  if (source.length !== target.length || source.some((element, index) => element.tagName !== target[index]!.tagName ||
    comparable(element) !== comparable(target[index]!)))
    throw new Error('OneNote recibió el cambio, pero la estructura devuelta necesita revisión. Tu borrador se conserva.');
  return new Map(source.map((element, index) => [element.hasAttribute('data-note-unit-index')
    ? `unit:${element.getAttribute('data-note-unit-index')}` : `draft:${element.getAttribute('data-note-draft-id')}`,
    target[index]!.getAttribute('data-note-unit-index')!]));
}
export function rebaseOneNoteEditorHtml(html: string, identities: Map<string, string>) {
  const body = parse(html);
  for (const element of body.querySelectorAll('[data-note-unit-index],[data-note-draft-id]')) {
    const key = element.hasAttribute('data-note-unit-index') ? `unit:${element.getAttribute('data-note-unit-index')}`
      : `draft:${element.getAttribute('data-note-draft-id')}`;
    const index = identities.get(key); if (index === undefined) continue;
    element.setAttribute('data-note-unit-index', index); element.removeAttribute('data-note-draft-id');
  }
  return body.innerHTML;
}
