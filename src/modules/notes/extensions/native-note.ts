import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/** Invisible provenance for the existing editor, not a separate editing surface. */
export const NativeNoteIdentity = Extension.create({
  name: 'nativeNoteIdentity',
  addOptions() { return { enabled: () => false, unitBlocks:()=>false }; },
  addGlobalAttributes() {
    const attributes = {
      nativeIndex: {
        default: null,
        keepOnSplit: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-note-unit-index'),
        renderHTML: (attributes: Record<string, unknown>) => attributes.nativeIndex === null ? {} : { 'data-note-unit-index': attributes.nativeIndex },
      },
      nativeDraftId: {
        default: null, keepOnSplit: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-note-draft-id'),
        renderHTML: (attributes: Record<string, unknown>) => attributes.nativeDraftId === null ? {} : { 'data-note-draft-id': attributes.nativeDraftId },
      },
    };
    return [
      { types: ['paragraph', 'heading', 'listItem', 'taskItem', 'codeBlock', 'blockquote'], attributes },
      { types: ['orderedList', 'bulletList'], attributes: { ...attributes,
        // ListKeymap recreates containers when removing an empty item. The
        // surviving list keeps its identity; a new paragraph/item never does.
        nativeIndex: { ...attributes.nativeIndex, keepOnSplit: true } } },
    ];
  },
  addProseMirrorPlugins() {
    let lastKey = '';
    return [new Plugin({ props: { handleDOMEvents: { keydown: (_view, event) => { lastKey = (event as KeyboardEvent).key; return false; } } },
      appendTransaction: (transactions, _before, state) => {
      if (!this.options.enabled() || !transactions.some(transaction => transaction.docChanged)) return null;
      const transaction = state.tr; let changed = false;
      let previous: { node: ProseMirrorNode; position: number } | null = null;
      state.doc.forEach((node, position) => {
        if (changed) return;
        if (previous && ['Backspace', 'Delete'].includes(lastKey) && node.type.name === 'paragraph' && !node.content.size &&
          (node.attrs.nativeIndex === null || node.attrs.nativeIndex === undefined) &&
          ['orderedList', 'bulletList'].includes(previous.node.type.name)) return;
        if (previous && ['orderedList', 'bulletList'].includes(node.type.name) && node.type === previous.node.type &&
          node.attrs.nativeIndex !== null && node.attrs.nativeIndex !== undefined &&
          node.attrs.nativeIndex === previous.node.attrs.nativeIndex) {
          // Removing an empty middle point with ListKeymap leaves adjacent
          // fragments of the same native list. Rejoin that one logical list;
          // never merge different remote lists or cross a paragraph/object.
          transaction.replaceWith(previous.position, position + node.nodeSize,
            previous.node.copy(previous.node.content.append(node.content))); changed = true;
        }
        previous = { node, position };
      });
      if (changed) return transaction;
      state.doc.descendants((node, position) => {
        if (node.type.name === 'nativeNoteProtected' || node.attrs.nativeIndex !== null && node.attrs.nativeIndex !== undefined) return false;
        if(this.options.unitBlocks()&&['orderedList','bulletList','taskList'].includes(node.type.name))return;
        if (!(this.options.unitBlocks()?['paragraph','heading','listItem','taskItem','codeBlock','blockquote']:['paragraph', 'heading', 'orderedList', 'bulletList']).includes(node.type.name)) return;
        let knownChild = false;
        node.descendants(child => { if (child.attrs.nativeIndex !== null && child.attrs.nativeIndex !== undefined) knownChild = true; });
        if (knownChild) return;
        if (!node.attrs.nativeDraftId) {
          transaction.setNodeMarkup(position, undefined, { ...node.attrs, nativeDraftId: crypto.randomUUID() }); changed = true;
        }
        return false;
      });
      return changed ? transaction.setMeta('addToHistory', false) : null;
    } })];
  },
});

/** Unknown native content remains an opaque, visible atom. Never serialize it
 * through TipTap's text schema or send its HTML as an upstream replacement. */
export const NativeNoteProtected = Node.create({
  name: 'nativeNoteProtected',
  group: 'block', atom: true, draggable: false, selectable: true,
  addAttributes() {
    return {
      nativeKey: { default: '', parseHTML: element => element.getAttribute('data-note-protected-key') },
      html: { default: '', parseHTML: element => element.innerHTML, rendered: false },
    };
  },
  parseHTML() { return [{ tag: 'div[data-note-protected-key]' }]; },
  addProseMirrorPlugins() {
    const signature = (doc: ProseMirrorNode) => {
      const keys: string[] = [];
      doc.descendants(node => { if (node.type.name === this.name) keys.push(`${node.attrs.nativeKey}:${node.attrs.html}`); });
      return JSON.stringify(keys);
    };
    return [new Plugin({ filterTransaction: (transaction, state) => {
      if (!transaction.docChanged || transaction.getMeta('preventUpdate')) return true;
      // Loading a new note uses setContent with emitUpdate:false. User delete,
      // cut, drag or select-all cannot silently remove protected content.
      if (signature(transaction.doc) === signature(state.doc)) return true;
      this.editor.view.dom.dispatchEvent(new CustomEvent('note-native-protected', { bubbles: true }));
      return false;
    } })];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-note-protected-key': node.attrs.nativeKey })];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.contentEditable = 'false';
      dom.dataset.noteProtectedKey = String(node.attrs.nativeKey);
      dom.innerHTML = String(node.attrs.html);
      return { dom, ignoreMutation: () => true };
    };
  },
});
