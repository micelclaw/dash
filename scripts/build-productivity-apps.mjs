import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Use the esbuild already installed by Core; this is asset compilation, not an installation or a runtime listener.
const dashRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coreRoot = resolve(dashRoot, '../micelclaw-os/core');
const { build } = createRequire(resolve(coreRoot, 'package.json'))('esbuild');
const views = { notes: 'NotesView', calendar: 'CalendarView', contacts: 'ContactsView', emails: 'MailView', files: 'FilesView', projects: 'ProjectsView', inventory: 'InventoryView', F1: 'FinanceView', F2: 'FinanceView', F6: 'FinanceView' };
const args = process.argv.slice(2); let output = resolve(coreRoot, 'assets/mcp-apps'); let selected = Object.keys(views);
for (let i = 0; i < args.length; i++) {
 if (args[i] === '--out-dir' && args[i + 1]) output = resolve(args[++i]);
 else if (args[i] === '--area' && views[args[i + 1]]) selected = [args[++i]];
 else throw Error('Use --area notes|calendar|contacts|emails|files|projects|inventory|F1|F2|F6 y/o --out-dir <directorio>.');
}
const results = [];
for (const area of selected) {
 const component = views[area];
 const result = await build({
  stdin: { contents: `import { mountProductivityApp } from './src/modules/chat/mcp-apps/productivity/bootstrap'; import View from './src/modules/chat/mcp-apps/productivity/${component}'; mountProductivityApp(${JSON.stringify(area)}, View);`, resolveDir: dashRoot, sourcefile: `productivity-${area}.tsx`, loader: 'tsx' },
  bundle: true, write: false, minify: true, format: 'iife', platform: 'browser', target: 'es2020', jsx: 'automatic', metafile: true,
  outdir: resolve(output, '.build'), alias: { '@': resolve(dashRoot, 'src') }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
 });
 const forbidden = Object.keys(result.metafile.inputs).filter(path => /(?:services\/api\.ts|stores\/(?:auth|profile)\.store\.ts|(?:Chat|Documents|Drive)Page\.tsx)$/.test(path));
 if (forbidden.length) throw Error(`El recurso ${area} arrastra dependencias de sesión o páginas: ${forbidden.join(', ')}`);
 const js = result.outputFiles.find(file => file.path.endsWith('.js'))?.text;
 const css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text || '';
 if (!js) throw Error(`Falta JavaScript para ${area}`);
 const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="app"><p>Cargando vista…</p></div><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
 if (Buffer.byteLength(html) > 1_000_000) throw Error(`El recurso ${area} supera el límite de un megabyte.`);
 results.push({ area, html, inputs: Object.keys(result.metafile.inputs).length });
}
await mkdir(output, { recursive: true });
for (const result of results) { await writeFile(resolve(output, `${result.area}.html`), result.html); console.log(`${result.area}: ${Buffer.byteLength(result.html)} bytes, ${result.inputs} fuentes, sin dependencias de sesión`); }
