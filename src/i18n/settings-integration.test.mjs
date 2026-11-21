import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('saved language survives discarded drafts and remains scoped to its session', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({
    root,
    configFile: false,
    resolve: { alias: { '@': `${root}src` } },
    define: { 'import.meta.env.VITE_MOCK_API': '"true"' },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'silent',
  });
  try {
    const { useAuthStore } = await vite.ssrLoadModule('/src/stores/auth.store.ts');
    const { useSettingsStore } = await vite.ssrLoadModule('/src/stores/settings.store.ts');
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'paco' }, sessionGeneration: 42 });
    await useSettingsStore.getState().fetchSettings();
    assert.equal(useSettingsStore.getState().serverSettings.general.language, 'en');

    const { SettingSelect } = await vite.ssrLoadModule('/src/components/settings/SettingSelect.tsx');
    const { languageOptions } = await vite.ssrLoadModule('/src/i18n/languages.ts');
    const markup = renderToStaticMarkup(React.createElement(SettingSelect, { label: 'Idioma', value: 'es', options: languageOptions('No disponible'), onChange() {} }));
    assert.equal((markup.match(/disabled=""/g) || []).length, 5);
    assert.match(markup, /value="es" selected/);
    assert.match(markup, /<label for="/);
    useSettingsStore.getState().setLocalValue('general.language', 'es');
    assert.equal(useSettingsStore.getState().serverSettings.general.language, 'en');
    await useSettingsStore.getState().updateSection('general', { language: 'es' });
    assert.equal(useSettingsStore.getState().serverSettings.general.language, 'es');
    useSettingsStore.getState().setLocalValue('general.language', 'en');
    useSettingsStore.getState().resetSection('general');
    assert.equal(useSettingsStore.getState().settings.general.language, 'es');
    useAuthStore.setState({ user: { id: 'other' }, sessionGeneration: 43 });
    await useSettingsStore.getState().fetchSettings();
    assert.equal(useSettingsStore.getState().serverSettings.general.language, 'en');
  } finally {
    await vite.close();
  }
});
