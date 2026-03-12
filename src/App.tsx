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

import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { LoginPage } from '@/pages/LoginPage';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

function AuthGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

// Lazy-loaded shell — loaded once authenticated
const ShellModule = () => import('@/components/shell/Shell').then((m) => ({ Component: m.Shell }));

const router = createBrowserRouter([
  {
    element: <AuthGate />,
    children: [
      {
        lazy: ShellModule,
        errorElement: <RouteErrorBoundary />,
        children: [
          { path: '/', element: <Navigate to="/chat" replace /> },
          { path: '/chat', lazy: () => import('@/modules/chat/ChatPage') },
          { path: '/search', lazy: () => import('@/modules/search/SearchPage') },
          { path: '/notes', lazy: () => import('@/modules/notes/NotesPage') },
          { path: '/calendar', lazy: () => import('@/modules/calendar/CalendarPage') },
          { path: '/mail', lazy: () => import('@/modules/mail/MailPage') },
          { path: '/contacts', lazy: () => import('@/modules/contacts/ContactsPage') },
          { path: '/diary', lazy: () => import('@/modules/diary/DiaryPage') },
          { path: '/bookmarks', lazy: () => import('@/modules/bookmarks/BookmarksPage') },
          { path: '/tools', lazy: () => import('@/modules/tools/ToolsPage') },
          { path: '/diagrams', lazy: () => import('@/modules/diagrams/DiagramsPage') },
          { path: '/diagrams/:fileId', lazy: () => import('@/modules/diagrams/DiagramEditor') },
          { path: '/projects', lazy: () => import('@/modules/projects/ProjectsPage') },
          { path: '/projects/:boardId', lazy: () => import('@/modules/projects/BoardView') },
          { path: '/tools/whiteboard', lazy: () => import('@/modules/tools/whiteboard/WhiteboardPage') },
          { path: '/tools/whiteboard/:fileId', lazy: () => import('@/modules/tools/whiteboard/WhiteboardPage') },
          { path: '/office', lazy: () => import('@/modules/office/OfficeLauncher') },
          { path: '/office/edit/:fileId', lazy: () => import('@/modules/office/OnlyOfficeEditor') },
          { path: '/office/pdf/:fileId', lazy: () => import('@/modules/office/PdfViewer') },
          { path: '/office/pdf/tools', lazy: () => import('@/modules/office/PdfToolsFrame') },
          { path: '/finance/firefly', lazy: () => import('@/modules/finance/FireflyPage') },
          { path: '/finance/solidinvoice', lazy: () => import('@/modules/finance/SolidInvoicePage') },
          { path: '/multimedia', lazy: () => import('@/modules/multimedia/MultimediaPage') },
          { path: '/multimedia/jellyfin', lazy: () => import('@/modules/multimedia/JellyfinPage') },
          { path: '/multimedia/qbittorrent', lazy: () => import('@/modules/multimedia/QbittorrentPage') },
          { path: '/multimedia/radarr', lazy: () => import('@/modules/multimedia/RadarrPage') },
          { path: '/multimedia/sonarr', lazy: () => import('@/modules/multimedia/SonarrPage') },
          { path: '/multimedia/lidarr', lazy: () => import('@/modules/multimedia/LidarrPage') },
          { path: '/multimedia/readarr', lazy: () => import('@/modules/multimedia/ReadarrPage') },
          { path: '/multimedia/jackett', lazy: () => import('@/modules/multimedia/JackettPage') },
          { path: '/multimedia/jellyseerr', lazy: () => import('@/modules/multimedia/JellyseerrPage') },
          { path: '/multimedia/navidrome', lazy: () => import('@/modules/multimedia/NavidromePage') },
          { path: '/multimedia/calibreweb', lazy: () => import('@/modules/multimedia/CalibreWebPage') },
          { path: '/multimedia/audiobookshelf', lazy: () => import('@/modules/multimedia/AudiobookshelfPage') },
          { path: '/crypto', lazy: () => import('@/modules/crypto/CryptoPage') },
          { path: '/crypto/btcpay', lazy: () => import('@/modules/crypto/btcpay/BtcPayEmbed') },
          { path: '/crypto/lightning', lazy: () => import('@/modules/crypto/lightning/LightningViewport') },
          { path: '/crypto/monero/wallet', lazy: () => import('@/modules/crypto/monero/viewport/MoneroWalletViewport') },
          { path: '/crypto/rotki', lazy: () => import('@/modules/crypto/rotki/RotkiEmbed') },
          { path: '/feeds', lazy: () => import('@/modules/feeds/FeedsPage') },
          { path: '/feeds/:feedId', lazy: () => import('@/modules/feeds/FeedsPage') },
          { path: '/drive', lazy: () => import('@/modules/drive/DrivePage') },
          { path: '/photos', lazy: () => import('@/modules/photos/PhotosPage') },
          { path: '/agents', lazy: () => import('@/modules/agents/AgentsPage') },
          { path: '/explorer', lazy: () => import('@/modules/explorer/ExplorerPage') },
          { path: '/storage', lazy: () => import('@/modules/storage/StoragePage') },
          { path: '/processes', lazy: () => import('@/modules/processes/ProcessesPage') },
          { path: '/termix', lazy: () => import('@/modules/termix/TermixPage') },
          { path: '/vpn', lazy: () => import('@/modules/vpn/VpnPage') },
          { path: '/proxy', lazy: () => import('@/modules/proxy/ProxyPage') },
          { path: '/portainer', lazy: () => import('@/modules/portainer/PortainerPage') },
          { path: '/approvals', lazy: () => import('@/modules/approvals/ApprovalsPage') },
          { path: '/digest/history', lazy: () => import('@/modules/digest/DigestHistoryPage') },
          { path: '/settings', lazy: () => import('@/modules/settings/SettingsPage') },
          { path: '/settings/:section', lazy: () => import('@/modules/settings/SettingsPage') },
          { path: '/clawhub', lazy: () => import('@/modules/clawhub/ClawHubPage') },
          // Dev-only routes
          ...(import.meta.env.DEV
            ? [{ path: '/dev/components', lazy: () => import('@/modules/dev/ComponentsDemo') }]
            : []),
        ],
      },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/oauth/callback', lazy: () => import('@/modules/oauth/OAuthCallbackPage') },
]);

export function App() {
  const notifSettings = useSettingsStore(s => s.settings?.notifications);
  const toastPosition = notifSettings?.toast_position ?? 'bottom-right';
  const toastDuration = notifSettings?.toast_duration_ms ?? 5000;

  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position={toastPosition}
        duration={toastDuration}
        toastOptions={{
          style: {
            background: 'var(--card)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            fontFamily: 'var(--font-sans)',
          },
        }}
      />
    </>
  );
}
