import type { MockRoute } from '../api-spy';

const SERVICES = [
  { name: 'bitcoind', display_name: 'Bitcoin Core', installed: true, running: false, ram_mb: null, uptime_seconds: null, phase: 'stopped', error: null },
  { name: 'btcpay', display_name: 'BTCPay Server', installed: true, running: false, ram_mb: null, uptime_seconds: null, phase: 'stopped', error: null },
  { name: 'lightning', display_name: 'Core Lightning', installed: true, running: false, ram_mb: null, uptime_seconds: null, phase: 'stopped', error: null },
  { name: 'monerod', display_name: 'Monero Node', installed: true, running: false, ram_mb: null, uptime_seconds: null, phase: 'stopped', error: null },
  { name: 'monero-wallet', display_name: 'Monero Wallet', installed: true, running: false, ram_mb: null, uptime_seconds: null, phase: 'stopped', error: null },
  { name: 'rotki', display_name: 'Rotki', installed: true, running: false, ram_mb: null, uptime_seconds: null, phase: 'stopped', error: null },
];

const STACK_STATUS = {
  services: SERVICES,
  btc: null,
  btc_extended: null,
  monero: null,
  monero_extended: null,
  lightning: null,
  lightning_extended: null,
};

export const cryptoMocks: MockRoute[] = [
  // Status endpoints
  {
    method: 'GET',
    path: '/crypto/status',
    response: { data: STACK_STATUS },
  },
  {
    method: 'GET',
    path: '/crypto/status/services',
    response: { data: STACK_STATUS },
  },
  {
    method: 'GET',
    path: '/crypto/status/extended',
    response: { data: { btc_extended: null, monero_extended: null, lightning_extended: null } },
  },
  // BTC catch-all
  {
    method: 'GET',
    path: '/crypto/btc/**',
    response: { data: {} },
  },
  // BTCPay info
  {
    method: 'GET',
    path: '/crypto/btcpay/**',
    response: { data: {} },
  },
  // Lightning catch-all
  {
    method: 'GET',
    path: '/crypto/lightning/**',
    response: { data: {} },
  },
  // Monero catch-all
  {
    method: 'GET',
    path: '/crypto/monero/**',
    response: { data: {} },
  },
  // Monero wallet endpoints
  {
    method: 'GET',
    path: '/crypto/monero-wallet/**',
    response: { data: {} },
  },
  // Dependencies
  {
    method: 'GET',
    path: '/crypto/dependencies',
    response: { data: [] },
  },
  // Start services
  {
    method: 'POST',
    path: '/crypto/bitcoind/start',
    response: { data: { status: 'starting' } },
  },
  {
    method: 'POST',
    path: '/crypto/btcpay/start',
    response: { data: { status: 'starting' } },
  },
  {
    method: 'POST',
    path: '/crypto/lightning/start',
    response: { data: { status: 'starting' } },
  },
  {
    method: 'POST',
    path: '/crypto/monerod/start',
    response: { data: { status: 'starting' } },
  },
  {
    method: 'POST',
    path: '/crypto/monero-wallet/start',
    response: { data: { status: 'starting' } },
  },
  {
    method: 'POST',
    path: '/crypto/rotki/start',
    response: { data: { status: 'starting' } },
  },
  // Stop services
  {
    method: 'POST',
    path: '/crypto/bitcoind/stop',
    response: { data: { status: 'stopping' } },
  },
  {
    method: 'POST',
    path: '/crypto/btcpay/stop',
    response: { data: { status: 'stopping' } },
  },
  {
    method: 'POST',
    path: '/crypto/lightning/stop',
    response: { data: { status: 'stopping' } },
  },
  {
    method: 'POST',
    path: '/crypto/monerod/stop',
    response: { data: { status: 'stopping' } },
  },
  {
    method: 'POST',
    path: '/crypto/monero-wallet/stop',
    response: { data: { status: 'stopping' } },
  },
  {
    method: 'POST',
    path: '/crypto/rotki/stop',
    response: { data: { status: 'stopping' } },
  },
  // BTC operations
  {
    method: 'POST',
    path: '/crypto/btc/bootstrap',
    response: { data: { started: true } },
  },
  {
    method: 'POST',
    path: '/crypto/btc/load-snapshot',
    response: { data: { started: true } },
  },
  {
    method: 'POST',
    path: '/crypto/btc/peers/add',
    response: { data: { added: true } },
  },
  {
    method: 'POST',
    path: '/crypto/btc/peers/ban',
    response: { data: { banned: true } },
  },
  {
    method: 'PUT',
    path: '/crypto/btc/config',
    status: 204,
    response: null,
  },
  // Lightning operations
  {
    method: 'POST',
    path: '/crypto/lightning/channels/open',
    response: { data: { channel_id: 'ch-1' } },
  },
  {
    method: 'POST',
    path: '/crypto/lightning/channels/close',
    response: { data: { closed: true } },
  },
  {
    method: 'POST',
    path: '/crypto/lightning/channels/setfees',
    status: 204,
    response: null,
  },
  {
    method: 'POST',
    path: '/crypto/lightning/peers/connect',
    response: { data: { connected: true } },
  },
  {
    method: 'POST',
    path: '/crypto/lightning/withdraw',
    response: { data: { txid: 'tx-1' } },
  },
  {
    method: 'PUT',
    path: '/crypto/lightning/config',
    status: 204,
    response: null,
  },
  // Monero config
  {
    method: 'PUT',
    path: '/crypto/monero/config',
    status: 204,
    response: null,
  },
];
