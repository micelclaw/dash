import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type { FileRecord } from '@/types/files';
import {
  createNetworkRequestGate, hasMoreNetworkFiles, isWithinNetworkFolder, mergeNetworkPage, networkBreadcrumbs,
  networkDirectoryPath, networkFolderRootPath, networkFolderStatusLabel,
  networkListingParent, networkParentPath,
} from '../network-folders';

const root = networkFolderRootPath('familia');
const file = (id: string) => ({ id } as FileRecord);
const directory = (filepath: string) => ({ filepath, is_directory: true } as FileRecord);

test('la navegación permanece confinada a /shared/<slug> y consulta el parent indexado', () => {
  assert.equal(root, '/shared/familia');
  assert.equal(networkListingParent(root), '/shared/familia/');
  assert.equal(networkListingParent('/shared/familia/fotos/'), '/shared/familia/fotos/');
  assert.equal(isWithinNetworkFolder('/shared/familia/fotos', root), true);
  assert.equal(isWithinNetworkFolder('/shared/familia-maliciosa', root), false);
  assert.equal(networkDirectoryPath(root, directory('/shared/familia/fotos')), '/shared/familia/fotos');
  assert.equal(networkDirectoryPath(root, directory('/drive/privado')), null);
  assert.equal(networkParentPath(root, '/shared/familia'), root);
  assert.equal(networkParentPath(root, '/shared/familia/fotos/2026'), '/shared/familia/fotos');
  assert.equal(networkParentPath(root, '/drive/privado'), root);
});

test('breadcrumbs y paginación preservan el árbol completo', () => {
  assert.deepEqual(networkBreadcrumbs(root, '/shared/familia/fotos/2026'), [
    { label: 'fotos', path: '/shared/familia/fotos' },
    { label: '2026', path: '/shared/familia/fotos/2026' },
  ]);
  assert.deepEqual(networkBreadcrumbs(root, '/shared/otra'), []);
  assert.deepEqual(mergeNetworkPage([file('1')], [file('2')], 1).map((item) => item.id), ['1', '2']);
  assert.deepEqual(mergeNetworkPage([file('viejo')], [file('nuevo')], 0).map((item) => item.id), ['nuevo']);
  assert.equal(hasMoreNetworkFiles(100, 101), true);
  assert.equal(hasMoreNetworkFiles(101, 101), false);
});

test('las carpetas no se abren mientras el índice no está disponible', () => {
  assert.equal(networkFolderStatusLabel('pending'), 'Indexando…');
  assert.equal(networkFolderStatusLabel('indexing'), 'Indexando…');
  assert.equal(networkFolderStatusLabel('error'), 'Error de indexado');
  assert.equal(networkFolderStatusLabel('active'), 'Disponible');
});

test('una respuesta antigua no puede ganar aunque resuelva después', async () => {
  const gate = createNetworkRequestGate();
  const first = gate.begin();
  const second = gate.begin();
  const applied: string[] = [];

  await Promise.resolve().then(() => { if (gate.isCurrent(second)) applied.push('second'); });
  await Promise.resolve().then(() => { if (gate.isCurrent(first)) applied.push('first'); });

  assert.equal(first.controller.signal.aborted, true);
  assert.deepEqual(applied, ['second']);
  gate.abort();
  assert.equal(gate.isCurrent(second), false);
});

test('guardarraíl: la UI real cablea raíces, estado, páginas y descarga sin mutaciones', () => {
  const view = readFileSync(fileURLToPath(new URL('../views/NetworkFoldersView.tsx', import.meta.url)), 'utf8');
  const page = readFileSync(fileURLToPath(new URL('../DrivePage.tsx', import.meta.url)), 'utf8');
  const store = readFileSync(fileURLToPath(new URL('../../../stores/drive.store.ts', import.meta.url)), 'utf8');
  const service = readFileSync(fileURLToPath(new URL('../../../services/shared-folders.service.ts', import.meta.url)), 'utf8');
  const settings = readFileSync(fileURLToPath(new URL('../../../components/settings/sections/SharedFoldersSection.tsx', import.meta.url)), 'utf8');
  const dialog = readFileSync(fileURLToPath(new URL('../../../components/settings/sections/SharedFolderEditDialog.tsx', import.meta.url)), 'utf8');

  const required = [
    /activeTab === 'network-folders'[\s\S]*<NetworkFoldersView\s*\/>/.test(page),
    store.includes("'network-folders'"), service.includes("'/shared-folders/mine'"),
    /parent_folder:\s*networkListingParent\(path\)/.test(view), /offset:\s*pageOffset/.test(view),
    /setTotal\(response\.meta\.total\)/.test(view), /hasMoreNetworkFiles\(files\.length, total\)/.test(view),
    /folder\.status !== 'active'/.test(view), /downloadFile\(file\.id/.test(view),
    view.includes('Esta carpeta se puede consultar y descargar desde Drive'),
    /updateSharedFolder\(folder\.id,\s*\{\s*index_in_drive:\s*enabled\s*\}\)/.test(settings),
    settings.includes('Habilitada') && settings.includes('No habilitada'),
    dialog.includes('label="Mostrar en Drive"'),
    (view.match(/requestGate\.isCurrent\(token\)/g)?.length ?? 0) >= 4,
    view.includes('requestGate.abort()'),
  ];
  assert.equal(required.length, 15);
  for (const found of required) assert.equal(found, true, 'el extractor debe encontrar cada costura de producción');
  const forbiddenMutation = /api\.(post|put|patch|delete)|DropZone|useUploadQueue|buildFileContextMenu|useFileClipboard/;
  assert.equal(forbiddenMutation.test(view), false, 'la vista de red no debe exponer mutaciones');
});
