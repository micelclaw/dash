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
          { path: '/drive', lazy: () => import('@/modules/drive/DrivePage') },
          { path: '/photos', lazy: () => import('@/modules/photos/PhotosPage') },
          { path: '/agents', lazy: () => import('@/modules/agents/AgentsPage') },
          { path: '/explorer', lazy: () => import('@/modules/explorer/ExplorerPage') },
          { path: '/storage', lazy: () => import('@/modules/storage/StoragePage') },
          { path: '/processes', lazy: () => import('@/modules/processes/ProcessesPage') },
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
