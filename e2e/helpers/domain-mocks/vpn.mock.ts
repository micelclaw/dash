import type { MockRoute } from '../api-spy';

const PEER_1 = {
  id: 'peer-1',
  name: 'Phone',
  public_key: 'xyz-peer-pubkey-placeholder',
  allowed_ips: '10.0.0.2/32',
  enabled: true,
  last_handshake: null,
};

export const vpnMocks: MockRoute[] = [
  // VPN status
  {
    method: 'GET',
    path: '/hal/network/vpn/status',
    response: {
      data: {
        enabled: true,
        interface: 'wg0',
        listen_port: 51820,
        public_key: 'abc-vpn-pubkey-placeholder',
        peers_count: 2,
      },
    },
  },
  // VPN peers
  {
    method: 'GET',
    path: '/hal/network/vpn/peers',
    response: {
      data: [PEER_1],
      meta: { total: 1, limit: 50, offset: 0 },
    },
  },
  // Import config
  {
    method: 'POST',
    path: '/hal/network/vpn/import',
    response: { data: { imported: true } },
  },
  // Regenerate keys
  {
    method: 'POST',
    path: '/hal/network/vpn/regenerate-keys',
    response: { data: { public_key: 'new-key' } },
  },
  // Restart VPN
  {
    method: 'POST',
    path: '/hal/network/vpn/restart',
    status: 204,
    response: null,
  },
  // Toggle peer
  {
    method: 'POST',
    path: '/hal/network/vpn/peers/**/toggle',
    response: { data: { enabled: false } },
  },
  // Update peer
  {
    method: 'PUT',
    path: '/hal/network/vpn/peers/*',
    response: { data: { ...PEER_1, name: 'Updated Phone' } },
  },
  // Delete peer
  {
    method: 'DELETE',
    path: '/hal/network/vpn/peers/*',
    status: 204,
    response: null,
  },
  // wg-easy clients
  {
    method: 'GET',
    path: '/wg-easy/clients',
    response: { data: [] },
  },
  // wg-easy toggle client
  {
    method: 'POST',
    path: '/wg-easy/clients/**/toggle',
    status: 204,
    response: null,
  },
  // wg-easy rename client
  {
    method: 'PUT',
    path: '/wg-easy/clients/**/name',
    status: 204,
    response: null,
  },
  // wg-easy delete client
  {
    method: 'DELETE',
    path: '/wg-easy/clients/*',
    status: 204,
    response: null,
  },
  // wg-easy dismiss IP change
  {
    method: 'POST',
    path: '/wg-easy/dismiss-ip-change',
    status: 204,
    response: null,
  },
  // Tailscale logout
  {
    method: 'POST',
    path: '/hal/network/tailscale/logout',
    status: 204,
    response: null,
  },
  // Tailscale status
  {
    method: 'GET',
    path: '/hal/network/tailscale/status',
    response: { data: { connected: false } },
  },
];
