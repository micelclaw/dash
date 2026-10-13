import assert from 'node:assert/strict';
import test from 'node:test';

import { privateNetworkAccessEnabled } from './browser-config.ui-state.ts';

test('private network browser access is disabled unless explicitly true', () => {
  assert.equal(privateNetworkAccessEnabled(undefined), false);
  assert.equal(privateNetworkAccessEnabled({}), false);
  assert.equal(privateNetworkAccessEnabled({ dangerously_allow_private_network: false }), false);
  assert.equal(privateNetworkAccessEnabled({ dangerously_allow_private_network: 'true' }), false);
  assert.equal(privateNetworkAccessEnabled({ dangerously_allow_private_network: true }), true);
});
