import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { observerDisconnectTarget } from './observer-disconnect';
import { connectorDeletePath } from '../../../../services/connector-delete-request';

test('hub: copy explícito y URL incluyen alcance y retención', () => {
  const action = observerDisconnectTarget('hub-id', true);
  assert.equal(action.label, 'Disconnect hub');
  assert.match(action.title, /shared hub/);
  assert.match(action.description, /ALL platforms/);
  assert.match(action.description, /not just this platform/);
  assert.match(action.description, /are kept/);
  assert.match(action.description, /does not log out/);
  assert.equal(connectorDeletePath(action.id, action.options), '/sync/connectors/hub-id?scope=hub&keep_data=1');
});
test('nativo: no solicita hub, sí retiene mensajes según el diálogo', () => {
  const action = observerDisconnectTarget('native-id', false);
  assert.equal(action.label, 'Disconnect');
  assert.equal(connectorDeletePath(action.id, action.options), '/sync/connectors/native-id?keep_data=1');
});
test('otros clientes conservan URL por defecto y purga; id escapado', () => {
  assert.equal(connectorDeletePath('data-id'), '/sync/connectors/data-id');
  assert.equal(connectorDeletePath('data-id', {}), '/sync/connectors/data-id');
  assert.equal(connectorDeletePath('id?scope=hub'), '/sync/connectors/id%3Fscope%3Dhub');
});
test('cableado real: fila, diálogo, opciones y cliente usan helpers', () => {
  const ui = readFileSync(new URL('../ChannelObserversSection.tsx', import.meta.url), 'utf8');
  assert.ok(ui.includes("observerDisconnectTarget(connectorId, platformMeta(platform).channelType === 'matrix')"));
  assert.ok(ui.includes('title={disconnectTarget?.title'));
  assert.ok(ui.includes('handleDisconnect(disconnectTarget)'));
  assert.ok(ui.includes('syncSvc.deleteConnector(target.id, target.options)'));
  const client = readFileSync(new URL('../../../../services/sync.service.ts', import.meta.url), 'utf8');
  assert.ok(client.includes('connectorDeletePath(connectorId, options)'));
});
