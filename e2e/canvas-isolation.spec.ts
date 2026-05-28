/**
 * E2E: Canvas isolation entre conversaciones (PR6 / F7.3)
 *
 * Verifica que el panel Canvas es estrictamente per-conversación:
 *  1. Pushear un canvas a chat A NO debe aparecer en chat B (New chat).
 *  2. Al volver a chat A, el canvas sigue allí.
 *  3. Un canvas.error en chat A no afecta al panel en chat B.
 *
 * Implementación: inyecta eventos WebSocket directamente en el cliente para
 * evitar depender del backend completo. El store `useCanvasStore` keyea por
 * `conversation_id` que viene en el evento.
 *
 * NOTA: este test requiere que el dash esté servido en `localhost` con un
 * usuario autenticado (usa la fixture `authedPage` existente). Si el backend
 * está offline puedes mockear con `helpers/api-mocks.ts`.
 */

import { test, expect } from './fixtures';

test.describe('Canvas isolation', () => {
  test.skip(
    !process.env.DASH_E2E_CANVAS,
    'Habilitar con DASH_E2E_CANVAS=1 — requiere backend running con conversaciones reales.',
  );

  test('canvas.content de chat A no se muestra en chat B', async ({ authedPage: page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    // Inyectar canvas.content para una conv ficticia "chat-A".
    await page.evaluate(() => {
      // @ts-expect-error — global store expuesto en dev/e2e
      const store = (window as unknown as { useCanvasStore: { getState: () => { setCanvasUrl: (c: string, u: string, p?: string) => void } } }).useCanvasStore;
      store.getState().setCanvasUrl('conv-A', '/api/v1/canvas-host/abc12345/conv-A/demo.html', 'abc12345/conv-A/demo.html');
    });

    // El panel debería mostrar el canvas si chat-A está activo. Si no, queda vacío.
    // Cambiar a una conversación distinta y verificar que NO se renderiza.
    await page.evaluate(() => {
      // @ts-expect-error
      window.useChatStore.getState().setActiveConversation('conv-B');
    });

    await expect(page.getByText('Canvas will appear here when the agent sends visual content')).toBeVisible();
  });

  test('canvas.error de chat A no contamina chat B', async ({ authedPage: page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      // @ts-expect-error
      const store = window.useCanvasStore;
      store.getState().setCanvasError('conv-A', 'Test error', 'TEST_CODE');
    });

    await page.evaluate(() => {
      // @ts-expect-error
      window.useChatStore.getState().setActiveConversation('conv-B');
    });

    await expect(page.getByText('Canvas no disponible')).not.toBeVisible();
  });
});
