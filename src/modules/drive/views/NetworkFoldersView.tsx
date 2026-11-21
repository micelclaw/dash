import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Download, FolderOpen, RefreshCw, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { FileIcon } from '@/components/shared/FileIcon';
import { api } from '@/services/api';
import { listMyDriveSharedFolders, type MySharedFolder } from '@/services/shared-folders.service';
import { downloadFile } from '@/lib/file-download';
import { formatFileSize } from '@/lib/file-utils';
import type { ApiListResponse } from '@/types/api';
import type { FileRecord } from '@/types/files';
import { useI18n } from '@/i18n';
import {
  NETWORK_FOLDER_PAGE_SIZE, createNetworkRequestGate, hasMoreNetworkFiles, mergeNetworkPage,
  networkBreadcrumbs, networkDirectoryPath, networkFolderRootPath,
  networkListingParent, networkParentPath,
} from '../network-folders';

export function NetworkFoldersView() {
  const { t } = useI18n();
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);
  const [folders, setFolders] = useState<MySharedFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<MySharedFolder | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestGate] = useState(createNetworkRequestGate);

  const loadRoots = useCallback(async () => {
    const token = requestGate.begin();
    setLoading(true); setError(null);
    try {
      const nextFolders = await listMyDriveSharedFolders();
      if (!requestGate.isCurrent(token)) return;
      setFolders(nextFolders);
    } catch (cause) {
      if (!requestGate.isCurrent(token)) return;
      setError(cause instanceof Error ? cause.message : tRef.current('drive.networkFolders.error.loadRoots'));
    } finally {
      if (requestGate.isCurrent(token)) setLoading(false);
    }
  }, [requestGate]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRoots(); }, 0);
    return () => { window.clearTimeout(timer); requestGate.abort(); };
  }, [loadRoots, requestGate]);

  const loadFiles = useCallback(async (path: string, pageOffset = 0) => {
    const token = requestGate.begin();
    if (pageOffset === 0) setLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const response = await api.get<ApiListResponse<FileRecord>>('/files', {
        parent_folder: networkListingParent(path), sort: 'filename', order: 'asc',
        limit: NETWORK_FOLDER_PAGE_SIZE, offset: pageOffset, no_cache: true,
      });
      if (!requestGate.isCurrent(token)) return;
      setFiles((current) => mergeNetworkPage(current, response.data, pageOffset));
      setTotal(response.meta.total);
    } catch (cause) {
      if (!requestGate.isCurrent(token)) return;
      setError(cause instanceof Error ? cause.message : tRef.current('drive.networkFolders.error.openFolder'));
    } finally {
      if (requestGate.isCurrent(token)) { setLoading(false); setLoadingMore(false); }
    }
  }, [requestGate]);

  const openRoot = (folder: MySharedFolder) => {
    if (folder.status !== 'active') return;
    const root = networkFolderRootPath(folder.slug);
    setSelectedFolder(folder); setCurrentPath(root); setFiles([]); setTotal(0);
    void loadFiles(root);
  };

  const openDirectory = (file: FileRecord) => {
    if (!selectedFolder) return;
    const next = networkDirectoryPath(networkFolderRootPath(selectedFolder.slug), file);
    if (!next) return;
    setCurrentPath(next); setFiles([]); setTotal(0); void loadFiles(next);
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path); setFiles([]); setTotal(0); void loadFiles(path);
  };

  const closeRoot = () => {
    setSelectedFolder(null); setCurrentPath(null); setFiles([]); setTotal(0); void loadRoots();
  };

  if (!selectedFolder || !currentPath) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">{t('drive.networkFolders.title')}</h2>
            <p className="mt-1 text-sm text-[var(--text-dim)]">{t('drive.networkFolders.description')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadRoots()} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('drive.networkFolders.refresh')}
          </Button>
        </div>
        {error && <ErrorPanel message={error} retry={loadRoots} retryLabel={t('drive.networkFolders.retry')} />}
        {!error && !loading && folders.length === 0 && (
          <EmptyState icon={Server} title={t('drive.networkFolders.empty.title')} description={t('drive.networkFolders.empty.description')} />
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {folders.map((folder) => {
            const available = folder.status === 'active';
            return (
              <button key={folder.id} type="button" disabled={!available} onClick={() => openRoot(folder)}
                title={folder.status === 'error' ? (folder.last_error ?? t('drive.networkFolders.error.lastIndexingFailed')) : undefined}
                className="flex min-h-28 flex-col items-start rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-colors enabled:hover:border-[var(--mod-drive)] disabled:cursor-not-allowed disabled:opacity-65">
                <FolderOpen className="mb-3 h-7 w-7 text-[var(--mod-drive)]" />
                <span className="font-medium text-[var(--text)]">{folder.name}</span>
                <span className={`mt-1 text-xs ${folder.status === 'error' ? 'text-[var(--error)]' : 'text-[var(--text-dim)]'}`}>
                  {available
                    ? t(folder.permission === 'ro' ? 'drive.networkFolders.permission.readOnly' : 'drive.networkFolders.permission.readWrite')
                    : t(folder.status === 'pending' || folder.status === 'indexing'
                      ? 'drive.networkFolders.status.indexing'
                      : folder.status === 'error' ? 'drive.networkFolders.status.error' : 'drive.networkFolders.status.available')}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const root = networkFolderRootPath(selectedFolder.slug);
  const crumbs = networkBreadcrumbs(root, currentPath);
  const atRoot = currentPath === root;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] px-4 py-3">
        <Button variant="ghost" size="sm" className="mr-1 gap-1.5" onClick={() => atRoot ? closeRoot() : navigateTo(networkParentPath(root, currentPath))}>
          <ArrowLeft className="h-4 w-4" /> {t('drive.networkFolders.back')}
        </Button>
        <button type="button" onClick={() => navigateTo(root)} className="text-sm font-medium text-[var(--text)] hover:text-[var(--mod-drive)]">{selectedFolder.name}</button>
        {crumbs.map((crumb) => (
          <span key={crumb.path} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <button type="button" onClick={() => navigateTo(crumb.path)} className="text-sm text-[var(--text-dim)] hover:text-[var(--text)]">{crumb.label}</button>
          </span>
        ))}
        <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" title={t('drive.networkFolders.refresh')} aria-label={t('drive.networkFolders.refresh')} onClick={() => navigateTo(currentPath)} disabled={loading || loadingMore}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs text-[var(--text-dim)]">{t('drive.networkFolders.readOnlyCopy')}</div>
      <div className="min-h-0 flex-1 overflow-auto">
        {error && <div className="p-4"><ErrorPanel message={error} retry={() => loadFiles(currentPath, files.length)} retryLabel={t('drive.networkFolders.retry')} /></div>}
        {!error && !loading && files.length === 0 && <EmptyState icon={FolderOpen} title={t('drive.networkFolders.emptyFolder.title')} description={t('drive.networkFolders.emptyFolder.description')} />}
        {!error && files.map((file) => (
          <div key={file.id} className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5 hover:bg-[var(--surface)]">
            <FileIcon mime={file.mime_type} isDirectory={file.is_directory} size="sm" />
            <button type="button" disabled={!file.is_directory} onClick={() => file.is_directory && openDirectory(file)}
              className={`min-w-0 flex-1 truncate text-left text-sm ${file.is_directory ? 'font-medium text-[var(--text)] hover:text-[var(--mod-drive)]' : 'text-[var(--text)]'}`}>{file.filename}</button>
            {!file.is_directory && <span className="hidden text-xs text-[var(--text-dim)] sm:block">{formatFileSize(file.size_bytes)}</span>}
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => void downloadFile(file.id, file.is_directory ? `${file.filename}.zip` : file.filename)}>
              <Download className="h-4 w-4" /> {t('drive.networkFolders.download')}
            </Button>
          </div>
        ))}
        {loading && <div className="p-8 text-center text-sm text-[var(--text-dim)]">{t('drive.networkFolders.loading')}</div>}
        {!error && !loading && hasMoreNetworkFiles(files.length, total) && (
          <div className="flex justify-center p-4">
            <Button variant="outline" onClick={() => void loadFiles(currentPath, files.length)} disabled={loadingMore}>
              {loadingMore ? t('drive.networkFolders.loading') : t('drive.networkFolders.loadMore', { loaded: files.length, total })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorPanel({ message, retry, retryLabel }: { message: string; retry: () => void | Promise<void>; retryLabel: string }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-[var(--error)]/40 bg-[var(--error)]/5 p-3 text-sm text-[var(--error)]">
      <span>{message}</span>
      <Button variant="outline" size="sm" onClick={() => void retry()}>{retryLabel}</Button>
    </div>
  );
}
