import type { FileRecord } from '@/types/files';

export const NETWORK_FOLDER_PAGE_SIZE = 100;

export interface NetworkBreadcrumb {
  label: string;
  path: string;
}

export function networkFolderRootPath(slug: string): string {
  return `/shared/${slug}`;
}

/** El índice guarda parent_folder con slash final; currentPath se mantiene sin él. */
export function networkListingParent(path: string): string {
  return `${path.replace(/\/+$/, '')}/`;
}

export function isWithinNetworkFolder(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

/** Solo acepta directorios y paths devueltos por Core dentro de la raíz elegida. */
export function networkDirectoryPath(root: string, file: FileRecord): string | null {
  if (!file.is_directory || !isWithinNetworkFolder(file.filepath, root)) return null;
  return file.filepath.replace(/\/+$/, '');
}

export function networkParentPath(root: string, currentPath: string): string {
  if (!isWithinNetworkFolder(currentPath, root) || currentPath === root) return root;
  const parent = currentPath.slice(0, currentPath.lastIndexOf('/'));
  return isWithinNetworkFolder(parent, root) ? parent : root;
}

export function networkBreadcrumbs(root: string, currentPath: string): NetworkBreadcrumb[] {
  if (!isWithinNetworkFolder(currentPath, root)) return [];
  const relative = currentPath.slice(root.length).replace(/^\/+/, '');
  if (!relative) return [];
  let path = root;
  return relative.split('/').filter(Boolean).map((label) => {
    path = `${path}/${label}`;
    return { label, path };
  });
}

export function mergeNetworkPage(current: FileRecord[], incoming: FileRecord[], offset: number): FileRecord[] {
  return offset === 0 ? incoming : [...current, ...incoming];
}

export function hasMoreNetworkFiles(loaded: number, total: number): boolean {
  return loaded < total;
}

export function networkFolderStatusLabel(status: string): string {
  if (status === 'pending' || status === 'indexing') return 'Indexando…';
  if (status === 'error') return 'Error de indexado';
  return 'Disponible';
}

export interface NetworkRequestToken {
  generation: number;
  controller: AbortController;
}

export interface NetworkRequestGate {
  begin: () => NetworkRequestToken;
  isCurrent: (token: NetworkRequestToken) => boolean;
  abort: () => void;
}

export function createNetworkRequestGate(): NetworkRequestGate {
  let generation = 0;
  let current: NetworkRequestToken | null = null;
  return {
    begin: () => {
      current?.controller.abort();
      current = { generation: ++generation, controller: new AbortController() };
      return current;
    },
    isCurrent: (token) => current === token && !token.controller.signal.aborted,
    abort: () => { current?.controller.abort(); current = null; },
  };
}
