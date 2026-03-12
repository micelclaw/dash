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

// ─── Shared types for crypto dashboard ────────────────────────────────

export interface CryptoServiceStatus {
  name: string;
  display_name: string;
  installed: boolean;
  running: boolean;
  ram_mb: number | null;
  uptime_seconds: number | null;
  phase: string;
  error: string | null;
}

export interface BtcSync {
  chain: string;
  blocks: number;
  headers: number;
  verification_progress: number;
  synced: boolean;
  pruned: boolean;
  prune_target_mb: number | null;
  size_on_disk_bytes: number;
  peers: number;
  estimated_time_remaining_s: number | null;
  uptime_seconds: number | null;
}

export interface MoneroSync {
  height: number;
  target_height: number;
  synced: boolean;
  pruned: boolean;
  size_on_disk_bytes: number;
  peers_in: number;
  peers_out: number;
  uptime_seconds: number | null;
}

export interface MoneroExtendedStats {
  version: string;
  difficulty: number;
  tx_count: number;
  tx_pool_size: number;
  white_peerlist_size: number;
  grey_peerlist_size: number;
  free_space: number;
  last_block_hash: string;
  last_block_time: number;
  last_block_size: number;
  last_block_txs: number;
  last_block_reward: number;
  fee_per_byte: number | null;
}

export interface LightningInfo {
  id: string;
  alias: string;
  num_channels: number;
  num_active_channels: number;
  num_peers: number;
  total_capacity_sat: number;
  synced_to_chain: boolean;
}

export interface BtcExtendedStats {
  mempool_tx_count: number;
  mempool_size_bytes: number;
  mempool_min_fee: number;
  difficulty: number;
  network_hashps: number;
  total_bytes_recv: number;
  total_bytes_sent: number;
  fee_rate_sat_vb: number | null;
  latest_block_hash: string;
  latest_block_time: number;
  latest_block_tx_count: number;
  latest_block_size: number;
  indexes: Record<string, { synced: boolean; best_block_height: number }>;
  connections_in: number;
  connections_out: number;
  version: number;
  subversion: string;
}

export interface LightningExtendedStats {
  total_forwards: number;
  successful_forwards: number;
  total_fees_earned_msat: number;
  feerate_perkw_opening: number | null;
  feerate_perkw_mutual_close: number | null;
  feerate_perkw_unilateral_close: number | null;
  known_nodes: number;
  known_channels: number;
}

export interface StackStatus {
  services: CryptoServiceStatus[];
  btc: BtcSync | null;
  btc_extended: BtcExtendedStats | null;
  monero: MoneroSync | null;
  monero_extended: MoneroExtendedStats | null;
  lightning: LightningInfo | null;
  lightning_extended: LightningExtendedStats | null;
}

export type WizardTarget = 'bitcoind' | 'lightning' | 'monerod' | 'btcpay' | null;
