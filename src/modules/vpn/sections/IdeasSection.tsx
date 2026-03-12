import { useState } from 'react';
import {
  ChevronDown, ChevronRight, ArrowRight,
  Globe, Shield, Server, Users, Split, Lock, Bitcoin, MonitorSmartphone,
  Lightbulb, Radio, Activity,
} from 'lucide-react';

interface IdeasSectionProps {
  onOpenPanel: () => void;
}

/* ── use-case data ─────────────────────────────────────────────── */

interface FieldRow {
  field: string;
  value: string;
  why: string;
}

interface UseCase {
  id: string;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  tagline: string;
  overview: string;
  clientFields: FieldRow[];
  server?: string;
  globalSettings?: string;
  additionalConfig?: string;
  tip?: string;
}

const USE_CASES: UseCase[] = [
  {
    id: 'remote-access',
    icon: MonitorSmartphone,
    title: 'Remote Access to Your Server',
    tagline: 'Access Micelclaw OS and all services from anywhere',
    overview:
      'Connect your phone, laptop, or tablet to your server from any network. Once connected, you can access Drive, Photos, Diary, Mail, and every other Claw service as if you were on the local network.',
    clientFields: [
      { field: 'Name', value: 'phone-victor  or  laptop-remote', why: 'Identify the device' },
      { field: 'Email', value: 'Your email', why: 'Optional, for reference' },
      { field: 'IP Allocation', value: 'Auto (use suggested)', why: 'Server assigns from pool' },
      { field: 'Allowed IPs', value: '10.252.1.0/24', why: 'Only route VPN subnet (split tunnel)' },
      { field: 'Extra Allowed IPs', value: 'Leave empty', why: 'No extra routes needed' },
      { field: 'Endpoint', value: 'Your public IP or DDNS', why: 'e.g. vpn.example.com' },
      { field: 'Use Server DNS', value: 'Yes', why: 'Resolve internal names via server' },
      { field: 'Enable after creation', value: 'Yes', why: 'Activate immediately' },
      { field: 'Public Key', value: 'Auto-generated', why: "Don't change" },
      { field: 'Preshared Key', value: 'Auto-generated', why: 'Extra layer of encryption' },
    ],
    server: 'No changes needed — defaults work.',
    globalSettings: 'Ensure Endpoint Address is set to your public IP or domain.',
    tip: 'Download the config file or scan the QR code with the WireGuard mobile app.',
  },
  {
    id: 'full-tunnel',
    icon: Globe,
    title: 'Route ALL Traffic (Full Tunnel)',
    tagline: 'Full privacy on public WiFi — route 100% of traffic through your server',
    overview:
      'Every packet leaving your device goes through the encrypted WireGuard tunnel to your server, then exits to the internet from there. Perfect for untrusted networks like airports, cafes, or hotels.',
    clientFields: [
      { field: 'Name', value: 'phone-fulltunnel', why: 'Identify purpose' },
      { field: 'IP Allocation', value: 'Auto (use suggested)', why: 'Server assigns from pool' },
      { field: 'Allowed IPs', value: '0.0.0.0/0, ::/0', why: 'Route ALL traffic (IPv4 + IPv6)' },
      { field: 'Use Server DNS', value: 'Yes', why: 'Prevent DNS leaks' },
      { field: 'Enable after creation', value: 'Yes', why: 'Activate immediately' },
    ],
    server: 'Ensure IP forwarding is enabled (net.ipv4.ip_forward=1 — already set in compose).',
    globalSettings: 'Verify Post Up Script has iptables MASQUERADE rule for NAT.',
    tip: 'Test your exit IP at https://whatismyipaddress.com — it should show your server\'s IP, not your local one.',
  },
  {
    id: 'nas-media',
    icon: Server,
    title: 'Personal NAS / Media Server',
    tagline: 'Access NAS, Jellyfin, or LAN services remotely',
    overview:
      'Reach your NAS, media server (Jellyfin, Plex), or any other device on your home LAN through the VPN tunnel. Your phone becomes part of the home network.',
    clientFields: [
      { field: 'Name', value: 'tablet-media', why: 'Device + purpose' },
      { field: 'IP Allocation', value: 'Auto (use suggested)', why: 'Server assigns from pool' },
      { field: 'Allowed IPs', value: '10.252.1.0/24, 192.168.1.0/24', why: 'VPN subnet + your LAN subnet' },
      { field: 'Extra Allowed IPs', value: 'Your LAN subnet if different', why: 'e.g. 192.168.0.0/24' },
      { field: 'Use Server DNS', value: 'Yes', why: 'Resolve local hostnames' },
      { field: 'Enable after creation', value: 'Yes', why: 'Activate immediately' },
    ],
    server: 'Add PostUp rule: iptables -A FORWARD -i wg0 -o eth0 -j ACCEPT to allow forwarding to LAN.',
    tip: 'Replace 192.168.1.0/24 with your actual LAN subnet. Check with "ip route" on the server.',
  },
  {
    id: 'site-to-site',
    icon: Shield,
    title: 'Remote Office / Site-to-Site',
    tagline: "Connect a remote location's entire network to your server",
    overview:
      'Link two networks together: your main server and a remote office. All devices in both locations can see each other as if they were on the same LAN.',
    clientFields: [
      { field: 'Name', value: 'office-gateway', why: "This is the office's router/gateway" },
      { field: 'IP Allocation', value: 'Auto (use suggested)', why: 'Server assigns from pool' },
      { field: 'Allowed IPs', value: '10.252.1.0/24, 192.168.50.0/24', why: 'VPN + office LAN' },
      { field: 'Extra Allowed IPs', value: '192.168.50.0/24', why: 'Office subnet routed through this peer' },
      { field: 'Enable after creation', value: 'Yes', why: 'Activate immediately' },
    ],
    server: 'Add routes for the office subnet. In PostUp: ip route add 192.168.50.0/24 via 10.252.1.X (peer\'s VPN IP).',
    tip: 'The office gateway device needs WireGuard installed and IP forwarding enabled.',
  },
  {
    id: 'family',
    icon: Users,
    title: 'Family / Team Shared Network',
    tagline: 'Let family or team members access shared services',
    overview:
      'Give family members or teammates secure access to your file server, media library, home automation, or any service running on your server. Each person gets their own VPN client.',
    clientFields: [
      { field: 'Name', value: 'maria-phone, papa-laptop', why: 'Person + device' },
      { field: 'IP Allocation', value: 'Auto (use suggested)', why: 'Each person gets unique IP' },
      { field: 'Allowed IPs', value: '10.252.1.0/24', why: 'Only VPN subnet access' },
      { field: 'Use Server DNS', value: 'Yes', why: 'Access services by name' },
      { field: 'Enable after creation', value: 'Yes', why: 'Ready to use immediately' },
    ],
    server: 'No changes. Each person gets their own client + QR code.',
    tip: 'Use the QR code feature — family members scan it with the WireGuard mobile app. No manual config needed.',
  },
  {
    id: 'split-tunnel',
    icon: Split,
    title: 'Split Tunnel — Selective Privacy',
    tagline: 'Route only specific traffic through VPN, keep local internet fast',
    overview:
      'Only VPN-destined traffic goes through the tunnel. Everything else uses your regular internet connection. Best of both worlds: privacy where you need it, speed everywhere else.',
    clientFields: [
      { field: 'Name', value: 'laptop-split', why: 'Split tunnel device' },
      { field: 'IP Allocation', value: 'Auto (use suggested)', why: 'Server assigns from pool' },
      { field: 'Allowed IPs', value: '10.252.1.0/24', why: 'Only VPN traffic goes through tunnel' },
      { field: 'Use Server DNS', value: 'No', why: 'Use local DNS for speed' },
      { field: 'Enable after creation', value: 'Yes', why: 'Activate immediately' },
    ],
    additionalConfig: `[Interface]
# Advanced: app-specific routing on the client side
Table = off
PostUp = ip rule add fwmark 51820 table 51820; ip route add default via 10.252.1.1 table 51820
PostDown = ip rule del fwmark 51820 table 51820`,
    tip: 'Split tunnel is mostly configured on the client side. The server just needs to accept the connection.',
  },
  {
    id: 'admin',
    icon: Lock,
    title: 'Secure Server Administration',
    tagline: 'Admin servers through encrypted tunnel instead of exposing ports',
    overview:
      'Access SSH, admin panels, and databases through the VPN tunnel. Then close those ports on the public firewall — only VPN-connected admins can reach them.',
    clientFields: [
      { field: 'Name', value: 'admin-laptop', why: 'Admin device' },
      { field: 'IP Allocation', value: 'Auto (use suggested)', why: 'Server assigns from pool' },
      { field: 'Allowed IPs', value: '10.252.1.0/24, 10.0.0.0/8', why: 'VPN + server management subnet' },
      { field: 'Use Server DNS', value: 'Yes', why: 'Resolve server hostnames' },
      { field: 'Preshared Key', value: 'Auto-generated', why: 'Extra security for admin access' },
      { field: 'Enable after creation', value: 'Yes', why: 'Activate immediately' },
    ],
    server: 'Close public SSH (port 22) on firewall. Only allow SSH from VPN subnet 10.252.1.0/24.',
    tip: 'After VPN is working, update firewall: ufw allow from 10.252.1.0/24 to any port 22.',
  },
  {
    id: 'crypto-node',
    icon: Bitcoin,
    title: 'Private Cryptocurrency Node',
    tagline: 'Route wallet traffic through your own node for maximum privacy',
    overview:
      'Connect your crypto wallet to your own full node through the VPN. Your transaction broadcasts and balance queries never touch third-party servers or the public internet.',
    clientFields: [
      { field: 'Name', value: 'wallet-phone', why: 'Wallet device' },
      { field: 'IP Allocation', value: 'Auto (use suggested)', why: 'Server assigns from pool' },
      { field: 'Allowed IPs', value: '10.252.1.0/24', why: 'Only route to VPN (node is on VPN)' },
      { field: 'Use Server DNS', value: 'Yes', why: 'Resolve node address' },
      { field: 'Enable after creation', value: 'Yes', why: 'Activate immediately' },
    ],
    server: 'Run your node (Monero, Bitcoin, etc.) listening on VPN interface 10.252.1.1.',
    tip: 'Configure wallet to connect to 10.252.1.1:18081 (Monero) or :8332 (Bitcoin). Traffic never touches public internet.',
  },
];

/* ── utility info cards ────────────────────────────────────────── */

interface UtilityInfo {
  id: string;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
}

const UTILITIES: UtilityInfo[] = [
  {
    id: 'wol',
    icon: Radio,
    title: 'Wake on LAN Hosts',
    description:
      'In the WireGuard panel, go to "Wake on LAN Hosts" to register LAN devices by MAC address and IP. Once registered, you can wake them remotely through the VPN — useful for turning on a NAS, desktop, or media server from anywhere in the world without leaving it running 24/7.',
  },
  {
    id: 'status',
    icon: Activity,
    title: 'Status Utility',
    description:
      'The Status page in the WireGuard panel shows the real-time state of the wg0 interface: which peers are connected, their last handshake time, data transferred (received/sent), and whether the interface is up. Use it to debug connection issues — if "last handshake" is recent, the tunnel is working.',
  },
];

/* ── component ─────────────────────────────────────────────────── */

export function IdeasSection({ onOpenPanel }: IdeasSectionProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{ padding: 24, maxWidth: 900, overflow: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Lightbulb size={22} style={{ color: '#eab308' }} />
          <h2 style={{
            fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)',
            margin: 0, fontFamily: 'var(--font-sans)',
          }}>
            VPN Use Cases
          </h2>
        </div>
        <p style={{
          color: 'var(--text-muted)', fontSize: '0.8125rem',
          margin: '0 0 16px', lineHeight: 1.5,
        }}>
          Practical ideas for your WireGuard VPN. Each card explains what it does and exactly how to configure it in the WireGuard panel.
        </p>
        <button
          onClick={onOpenPanel}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 20px',
            background: '#7c3aed',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'opacity var(--transition-fast)',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          Open WireGuard Panel
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Use-case cards */}
      {USE_CASES.map(uc => (
        <UseCaseCard
          key={uc.id}
          useCase={uc}
          open={!!expanded[uc.id]}
          onToggle={() => toggle(uc.id)}
        />
      ))}

      {/* Separator */}
      <div style={{
        height: 1, background: 'var(--border)', margin: '28px 0 20px',
      }} />

      {/* Utility info cards */}
      <h3 style={{
        fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)',
        margin: '0 0 12px', fontFamily: 'var(--font-sans)',
      }}>
        Useful Utilities in the Panel
      </h3>
      {UTILITIES.map(u => (
        <UtilityCard key={u.id} info={u} />
      ))}
    </div>
  );
}

/* ── use-case card ─────────────────────────────────────────────── */

function UseCaseCard({ useCase: uc, open, onToggle }: {
  useCase: UseCase;
  open: boolean;
  onToggle: () => void;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  const Icon = uc.icon;

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${open ? 'rgba(124, 58, 237, 0.35)' : 'rgba(124, 58, 237, 0.15)'}`,
      background: open
        ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.06), rgba(124, 58, 237, 0.02))'
        : 'var(--surface)',
      borderLeft: open ? '3px solid #7c3aed' : '3px solid transparent',
      marginBottom: 10,
      transition: 'border-color 0.15s, background 0.15s',
    }}>
      {/* Header row */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '14px 16px',
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', fontFamily: 'var(--font-sans)',
        }}
      >
        <Chevron size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <Icon size={18} style={{ color: '#7c3aed', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            {uc.title}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
            {uc.tagline}
          </div>
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div style={{ padding: '0 16px 16px 42px' }}>
          {/* Overview */}
          <p style={{
            fontSize: '0.8125rem', color: 'var(--text-dim)',
            lineHeight: 1.6, margin: '0 0 14px',
          }}>
            {uc.overview}
          </p>

          {/* Client configuration table */}
          <SectionLabel>Client Configuration (New Client)</SectionLabel>
          <div style={{
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            marginBottom: 14,
          }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
            }}>
              <thead>
                <tr style={{ background: 'var(--surface-hover)' }}>
                  <th style={thStyle}>Field</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Why</th>
                </tr>
              </thead>
              <tbody>
                {uc.clientFields.map((row, i) => (
                  <tr key={row.field} style={{
                    background: i % 2 === 0 ? 'transparent' : 'var(--surface)',
                  }}>
                    <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text)' }}>{row.field}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono, monospace)', color: '#7c3aed' }}>
                      {row.value}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{row.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Additional config code block */}
          {uc.additionalConfig && (
            <>
              <SectionLabel>Additional Configuration (client-side)</SectionLabel>
              <pre style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                fontSize: '0.6875rem',
                lineHeight: 1.6,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-dim)',
                overflow: 'auto',
                marginBottom: 14,
                whiteSpace: 'pre-wrap',
              }}>
                {uc.additionalConfig}
              </pre>
            </>
          )}

          {/* Server settings */}
          {uc.server && (
            <InfoBox label="WireGuard Server" text={uc.server} />
          )}

          {/* Global settings */}
          {uc.globalSettings && (
            <InfoBox label="Global Settings" text={uc.globalSettings} />
          )}

          {/* Tip */}
          {uc.tip && (
            <div style={{
              borderLeft: '3px solid #eab308',
              background: 'rgba(234, 179, 8, 0.06)',
              borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              padding: '8px 12px',
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              lineHeight: 1.5,
              marginTop: 10,
            }}>
              <strong style={{ color: '#eab308' }}>Tip:</strong> {uc.tip}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── utility card ──────────────────────────────────────────────── */

function UtilityCard({ info }: { info: UtilityInfo }) {
  const Icon = info.icon;
  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid rgba(34, 197, 94, 0.2)',
      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.04), rgba(34, 197, 94, 0.01))',
      padding: '14px 16px',
      marginBottom: 10,
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <Icon size={18} style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{
          fontSize: '0.875rem', fontWeight: 600,
          color: 'var(--text)', fontFamily: 'var(--font-sans)',
          marginBottom: 4,
        }}>
          {info.title}
        </div>
        <div style={{
          fontSize: '0.75rem', color: 'var(--text-dim)',
          lineHeight: 1.6, fontFamily: 'var(--font-sans)',
        }}>
          {info.description}
        </div>
      </div>
    </div>
  );
}

/* ── shared styles & helpers ───────────────────────────────────── */

const thStyle: React.CSSProperties = {
  padding: '6px 10px',
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--text-muted)',
  fontSize: '0.6875rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border)',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.6875rem', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      color: 'var(--text-muted)',
      marginBottom: 6,
      fontFamily: 'var(--font-sans)',
    }}>
      {children}
    </div>
  );
}

function InfoBox({ label, text }: { label: string; text: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 12px',
      marginBottom: 8,
      fontSize: '0.75rem',
      lineHeight: 1.5,
    }}>
      <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{label}: </strong>
      <span style={{ color: 'var(--text-dim)' }}>{text}</span>
    </div>
  );
}
