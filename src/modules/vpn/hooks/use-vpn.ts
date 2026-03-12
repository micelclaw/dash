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

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

export interface VpnStatus {
  installed: boolean;
  enabled: boolean;
  interface: string;
  listen_port: number;
  public_key: string;
  endpoint: string;
  peers_count: number;
  subnet: string;
}

export interface VpnPeer {
  id: string;
  name: string;
  public_key: string;
  allowed_ips: string;
  last_handshake: string | null;
  transfer_rx: number;
  transfer_tx: number;
}

export interface VpnPeerConfig {
  peer: VpnPeer;
  config_file: string;
  qr_code: string;
}

export interface VpnServerConfig {
  listen_port: number;
  address: string;
  dns: string[];
  mtu: number | null;
  post_up: string;
  post_down: string;
  pre_up: string;
  pre_down: string;
  save_config: boolean;
  fw_mark: number | null;
  table: string | null;
}

export interface VpnPeerUpdate {
  name?: string;
  allowed_ips?: string;
  persistent_keepalive?: number;
  preshared_key?: string | null;
  endpoint?: string | null;
  enabled?: boolean;
}

export function useVpn() {
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [peers, setPeers] = useState<VpnPeer[]>([]);
  const [serverConfig, setServerConfig] = useState<VpnServerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, peersRes, configRes] = await Promise.all([
        api.get<{ data: VpnStatus }>('/hal/network/vpn/status'),
        api.get<{ data: VpnPeer[] }>('/hal/network/vpn/peers'),
        api.get<{ data: VpnServerConfig }>('/hal/network/vpn/config'),
      ]);
      setStatus(statusRes.data);
      setPeers(peersRes.data);
      setServerConfig(configRes.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch VPN data');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  const toggleVpn = useCallback(async (enable: boolean) => {
    try {
      await api.post(`/hal/network/vpn/${enable ? 'enable' : 'disable'}`);
      toast.success(enable ? 'VPN enabled' : 'VPN disabled');
      await fetchAll();
    } catch {
      toast.error(`Failed to ${enable ? 'enable' : 'disable'} VPN`);
    }
  }, [fetchAll]);

  const addPeer = useCallback(async (name: string, options?: Partial<VpnPeerUpdate>) => {
    try {
      const res = await api.post<{ data: VpnPeerConfig }>('/hal/network/vpn/peers', { name, ...options });
      toast.success('Peer added');
      await fetchAll();
      return res.data;
    } catch {
      toast.error('Failed to add peer');
      return null;
    }
  }, [fetchAll]);

  const updatePeer = useCallback(async (peerId: string, update: VpnPeerUpdate) => {
    try {
      await api.put(`/hal/network/vpn/peers/${peerId}`, update);
      toast.success('Peer updated');
      await fetchAll();
    } catch {
      toast.error('Failed to update peer');
    }
  }, [fetchAll]);

  const togglePeer = useCallback(async (peerId: string, enabled: boolean) => {
    try {
      await api.post(`/hal/network/vpn/peers/${peerId}/toggle`, { enabled });
      toast.success(enabled ? 'Peer enabled' : 'Peer disabled');
      await fetchAll();
    } catch {
      toast.error('Failed to toggle peer');
    }
  }, [fetchAll]);

  const removePeer = useCallback(async (peerId: string) => {
    try {
      await api.delete(`/hal/network/vpn/peers/${peerId}`);
      toast.success('Peer removed');
      await fetchAll();
    } catch {
      toast.error('Failed to remove peer');
    }
  }, [fetchAll]);

  const getPeerConfig = useCallback(async (peerId: string) => {
    try {
      const res = await api.get<{ data: VpnPeerConfig }>(`/hal/network/vpn/peers/${peerId}/config`);
      return res.data;
    } catch {
      toast.error('Failed to get peer config');
      return null;
    }
  }, []);

  const updateServerConfig = useCallback(async (config: Partial<VpnServerConfig>) => {
    try {
      const res = await api.put<{ data: VpnServerConfig }>('/hal/network/vpn/config', config);
      setServerConfig(res.data);
      toast.success('Server config updated');
      return res.data;
    } catch {
      toast.error('Failed to update server config');
      return null;
    }
  }, []);

  const restartInterface = useCallback(async () => {
    try {
      await api.post('/hal/network/vpn/restart');
      toast.success('Interface restarted');
      await fetchAll();
    } catch {
      toast.error('Failed to restart interface');
    }
  }, [fetchAll]);

  const regenerateKeys = useCallback(async () => {
    try {
      await api.post('/hal/network/vpn/regenerate-keys');
      toast.success('Server keys regenerated');
      await fetchAll();
    } catch {
      toast.error('Failed to regenerate keys');
    }
  }, [fetchAll]);

  const exportConfig = useCallback(async () => {
    try {
      const res = await api.get<{ data: { config: string } }>('/hal/network/vpn/export');
      return res.data.config;
    } catch {
      toast.error('Failed to export config');
      return null;
    }
  }, []);

  const importConfig = useCallback(async (content: string) => {
    try {
      await api.post('/hal/network/vpn/import', { config: content });
      toast.success('Config imported');
      await fetchAll();
    } catch {
      toast.error('Failed to import config');
    }
  }, [fetchAll]);

  return {
    status, peers, serverConfig, loading, error,
    refresh: fetchAll,
    toggleVpn, addPeer, updatePeer, togglePeer, removePeer, getPeerConfig,
    updateServerConfig, restartInterface, regenerateKeys,
    exportConfig, importConfig,
  };
}
