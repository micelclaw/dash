import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingToggle } from '../SettingToggle';
import { SettingInput } from '../SettingInput';
import { SettingSelect } from '../SettingSelect';
import { SaveBar } from '../SaveBar';

// ─── Types ──────────────────────────────────────────────

interface ProxyRoute {
  id: string;
  path: string;
  upstream: string;
  description?: string;
}

interface ProxyStatus {
  running: boolean;
  domain?: string;
  routes_count: number;
}

interface VpnStatus {
  enabled: boolean;
  interface_up: boolean;
  peers_count: number;
  listen_port?: number;
}

interface VpnPeer {
  id: string;
  name: string;
  public_key: string;
  allowed_ips: string;
  last_handshake?: string;
  transfer_rx?: number;
  transfer_tx?: number;
}

interface FirewallStatus {
  active: boolean;
  rules_count: number;
  backend: string;
}

interface FirewallRule {
  id: string;
  port: number;
  protocol: string;
  direction: string;
  action: string;
  source?: string;
  description?: string;
}

// ─── Proxy Sub-section ─────────────────────────────────

function ProxySubSection() {
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [routes, setRoutes] = useState<ProxyRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoute, setNewRoute] = useState({ path: '', upstream: '', description: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, routesRes] = await Promise.all([
        api.get<{ data: ProxyStatus }>('/hal/network/proxy/status'),
        api.get<{ data: ProxyRoute[] }>('/hal/network/proxy/routes'),
      ]);
      setStatus(statusRes.data);
      setRoutes(routesRes.data);
    } catch {
      // Silent — section may not be available
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addRoute = async () => {
    if (!newRoute.path || !newRoute.upstream) return;
    try {
      await api.post('/hal/network/proxy/routes', newRoute);
      toast.success('Proxy route added');
      setNewRoute({ path: '', upstream: '', description: '' });
      setShowAddForm(false);
      fetchData();
    } catch {
      toast.error('Failed to add proxy route');
    }
  };

  const removeRoute = async (id: string) => {
    try {
      await api.delete(`/hal/network/proxy/routes/${id}`);
      toast.success('Route removed');
      fetchData();
    } catch {
      toast.error('Failed to remove route');
    }
  };

  if (loading) {
    return (
      <SettingSection title="Reverse Proxy" description="Caddy reverse proxy routes.">
        <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading...</div>
      </SettingSection>
    );
  }

  return (
    <SettingSection title="Reverse Proxy" description="Caddy reverse proxy routes.">
      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Status</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: status?.running ? '#22c55e' : '#6b7280' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: status?.running ? '#22c55e' : '#6b7280' }} />
          {status?.running ? 'Running' : 'Stopped'}
        </span>
      </div>

      {status?.domain && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Domain</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>{status.domain}</span>
        </div>
      )}

      {/* Routes */}
      <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            Routes ({routes.length})
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={fetchData}
              style={{ height: 26, padding: '0 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={12} />
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{ height: 26, padding: '0 8px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Plus size={12} /> Add
            </button>
          </div>
        </div>

        {showAddForm && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <input
              placeholder="Path (e.g. /api)"
              value={newRoute.path}
              onChange={(e) => setNewRoute((p) => ({ ...p, path: e.target.value }))}
              style={{ flex: 1, minWidth: 100, height: 30, padding: '0 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', outline: 'none', fontFamily: 'var(--font-sans)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            <input
              placeholder="Upstream (e.g. http://localhost:3000)"
              value={newRoute.upstream}
              onChange={(e) => setNewRoute((p) => ({ ...p, upstream: e.target.value }))}
              style={{ flex: 2, minWidth: 160, height: 30, padding: '0 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', outline: 'none', fontFamily: 'var(--font-sans)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            <button
              onClick={addRoute}
              disabled={!newRoute.path || !newRoute.upstream}
              style={{ height: 30, padding: '0 12px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', opacity: !newRoute.path || !newRoute.upstream ? 0.5 : 1 }}
            >
              Save
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              style={{ height: 30, padding: '0 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        )}

        {routes.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No routes configured</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {routes.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, flex: 1 }}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--amber)' }}>{r.path}</span>
                  <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.upstream}</span>
                </div>
                <button
                  onClick={() => removeRoute(r.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingSection>
  );
}

// ─── VPN Sub-section ────────────────────────────────────

function VpnSubSection() {
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [peers, setPeers] = useState<VpnPeer[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [newPeerName, setNewPeerName] = useState('');
  const [showAddPeer, setShowAddPeer] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, peersRes] = await Promise.all([
        api.get<{ data: VpnStatus }>('/hal/network/vpn/status'),
        api.get<{ data: VpnPeer[] }>('/hal/network/vpn/peers'),
      ]);
      setStatus(statusRes.data);
      setPeers(peersRes.data);
    } catch {
      // Silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleVpn = async (enable: boolean) => {
    setActing(true);
    try {
      await api.post(`/hal/network/vpn/${enable ? 'enable' : 'disable'}`);
      toast.success(enable ? 'VPN enabled' : 'VPN disabled');
      fetchData();
    } catch {
      toast.error(`Failed to ${enable ? 'enable' : 'disable'} VPN`);
    }
    setActing(false);
  };

  const addPeer = async () => {
    if (!newPeerName.trim()) return;
    try {
      await api.post('/hal/network/vpn/peers', { name: newPeerName.trim() });
      toast.success('VPN peer added');
      setNewPeerName('');
      setShowAddPeer(false);
      fetchData();
    } catch {
      toast.error('Failed to add VPN peer');
    }
  };

  const removePeer = async (id: string) => {
    try {
      await api.delete(`/hal/network/vpn/peers/${id}`);
      toast.success('Peer removed');
      fetchData();
    } catch {
      toast.error('Failed to remove peer');
    }
  };

  if (loading) {
    return (
      <SettingSection title="VPN (WireGuard)" description="Manage VPN connections and peers.">
        <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading...</div>
      </SettingSection>
    );
  }

  return (
    <SettingSection title="VPN (WireGuard)" description="Manage VPN connections and peers.">
      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Status</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: status?.enabled ? '#22c55e' : '#6b7280' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: status?.enabled ? '#22c55e' : '#6b7280' }} />
            {status?.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <button
            onClick={() => toggleVpn(!status?.enabled)}
            disabled={acting}
            style={{
              height: 26, padding: '0 10px',
              background: status?.enabled ? 'transparent' : 'var(--amber)',
              color: status?.enabled ? 'var(--text-dim)' : '#06060a',
              border: status?.enabled ? '1px solid var(--border)' : 'none',
              borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600,
              cursor: acting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            {status?.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Peers */}
      <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            Peers ({peers.length})
          </span>
          <button
            onClick={() => setShowAddPeer(!showAddPeer)}
            style={{ height: 26, padding: '0 8px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Plus size={12} /> Add Peer
          </button>
        </div>

        {showAddPeer && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              placeholder="Peer name"
              value={newPeerName}
              onChange={(e) => setNewPeerName(e.target.value)}
              style={{ flex: 1, height: 30, padding: '0 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', outline: 'none', fontFamily: 'var(--font-sans)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--amber)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              onKeyDown={(e) => e.key === 'Enter' && addPeer()}
            />
            <button onClick={addPeer} disabled={!newPeerName.trim()} style={{ height: 30, padding: '0 12px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', opacity: !newPeerName.trim() ? 0.5 : 1 }}>Save</button>
            <button onClick={() => setShowAddPeer(false)} style={{ height: 30, padding: '0 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer' }}>Cancel</button>
          </div>
        )}

        {peers.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No peers configured</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {peers.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 500, color: 'var(--text)' }}>{p.name}</span>
                  <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.allowed_ips}</span>
                </div>
                <button
                  onClick={() => removePeer(p.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingSection>
  );
}

// ─── Firewall Sub-section ───────────────────────────────

const PROTOCOL_OPTIONS = [
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'both', label: 'TCP+UDP' },
];

const ACTION_OPTIONS = [
  { value: 'allow', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
];

function FirewallSubSection() {
  const [status, setStatus] = useState<FirewallStatus | null>(null);
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({ port: '', protocol: 'tcp', action: 'allow', source: '', description: '' });

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, rulesRes] = await Promise.all([
        api.get<{ data: FirewallStatus }>('/hal/firewall/status'),
        api.get<{ data: FirewallRule[] }>('/hal/firewall/rules'),
      ]);
      setStatus(statusRes.data);
      setRules(rulesRes.data);
    } catch {
      // Silent
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleFirewall = async (enable: boolean) => {
    setActing(true);
    try {
      await api.post(`/hal/firewall/${enable ? 'enable' : 'disable'}`);
      toast.success(enable ? 'Firewall enabled' : 'Firewall disabled');
      fetchData();
    } catch {
      toast.error(`Failed to ${enable ? 'enable' : 'disable'} firewall`);
    }
    setActing(false);
  };

  const addRule = async () => {
    const port = parseInt(newRule.port);
    if (!port || port < 1 || port > 65535) {
      toast.error('Invalid port number');
      return;
    }
    try {
      await api.post('/hal/firewall/rules', {
        port,
        protocol: newRule.protocol,
        direction: 'in',
        action: newRule.action,
        source: newRule.source || undefined,
        description: newRule.description || undefined,
      });
      toast.success('Firewall rule added');
      setNewRule({ port: '', protocol: 'tcp', action: 'allow', source: '', description: '' });
      setShowAddForm(false);
      fetchData();
    } catch {
      toast.error('Failed to add firewall rule');
    }
  };

  const removeRule = async (id: string) => {
    try {
      await api.delete(`/hal/firewall/rules/${id}`);
      toast.success('Rule removed');
      fetchData();
    } catch {
      toast.error('Failed to remove rule');
    }
  };

  if (loading) {
    return (
      <SettingSection title="Firewall" description="Manage firewall rules and access.">
        <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading...</div>
      </SettingSection>
    );
  }

  return (
    <SettingSection title="Firewall" description="Manage firewall rules and access.">
      {/* Status + Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Status</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: status?.active ? '#22c55e' : '#6b7280' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: status?.active ? '#22c55e' : '#6b7280' }} />
            {status?.active ? `Active (${status.rules_count} rules)` : 'Inactive'}
          </span>
          <button
            onClick={() => toggleFirewall(!status?.active)}
            disabled={acting}
            style={{
              height: 26, padding: '0 10px',
              background: status?.active ? 'transparent' : 'var(--amber)',
              color: status?.active ? 'var(--text-dim)' : '#06060a',
              border: status?.active ? '1px solid var(--border)' : 'none',
              borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600,
              cursor: acting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            {status?.active ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Rules */}
      <div style={{ padding: '12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            Rules ({rules.length})
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={fetchData}
              style={{ height: 26, padding: '0 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <RefreshCw size={12} />
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{ height: 26, padding: '0 8px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Plus size={12} /> Add Rule
            </button>
          </div>
        </div>

        {showAddForm && (
          <div style={{ marginBottom: 8, padding: 10, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                placeholder="Port"
                type="number"
                value={newRule.port}
                onChange={(e) => setNewRule((p) => ({ ...p, port: e.target.value }))}
                style={{ width: 80, height: 30, padding: '0 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', outline: 'none', fontFamily: 'var(--font-sans)' }}
              />
              <select
                value={newRule.protocol}
                onChange={(e) => setNewRule((p) => ({ ...p, protocol: e.target.value }))}
                style={{ height: 30, padding: '0 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', outline: 'none' }}
              >
                {PROTOCOL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select
                value={newRule.action}
                onChange={(e) => setNewRule((p) => ({ ...p, action: e.target.value }))}
                style={{ height: 30, padding: '0 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', outline: 'none' }}
              >
                {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input
                placeholder="Source (e.g. any)"
                value={newRule.source}
                onChange={(e) => setNewRule((p) => ({ ...p, source: e.target.value }))}
                style={{ flex: 1, minWidth: 100, height: 30, padding: '0 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', outline: 'none', fontFamily: 'var(--font-sans)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddForm(false)} style={{ height: 26, padding: '0 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
              <button onClick={addRule} style={{ height: 26, padding: '0 10px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Add</button>
            </div>
          </div>
        )}

        {rules.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No rules configured</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {rules.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, flex: 1 }}>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 600, padding: '1px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: r.action === 'allow' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: r.action === 'allow' ? '#22c55e' : '#ef4444',
                  }}>
                    {r.action.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>:{r.port}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.protocol.toUpperCase()}</span>
                  {r.source && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>from {r.source}</span>}
                  {r.description && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>{r.description}</span>}
                </div>
                <button
                  onClick={() => removeRule(r.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingSection>
  );
}

// ─── Main Section ───────────────────────────────────────

export function NetworkSection() {
  return (
    <>
      <ProxySubSection />
      <VpnSubSection />
      <FirewallSubSection />
    </>
  );
}
