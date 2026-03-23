import { useCallback, useEffect, useState } from 'react';
import { useMailServerApi } from '@micelclaw/mail-admin-ui';
import { toast } from 'sonner';
import { Copy, Globe, Mail, ArrowUpDown, Inbox } from 'lucide-react';

interface ClientConfig {
  hostname: string;
  domain: string;
}

interface SettingRow {
  label: string;
  value: string;
}

interface ProtocolCard {
  icon: React.ReactNode;
  title: string;
  settings: SettingRow[];
}

function CopyButton({ value }: { value: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '4px 6px',
        cursor: 'pointer',
        color: 'var(--text-dim)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Copy size={12} />
    </button>
  );
}

function ProtocolCardComponent({ card }: { card: ProtocolCard }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {card.icon}
        <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9375rem' }}>{card.title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {card.settings.map((setting) => (
          <div
            key={setting.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'var(--bg)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{setting.label}</span>
              <span style={{ color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                {setting.value}
              </span>
            </div>
            <CopyButton value={setting.value} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClientSetup() {
  const api = useMailServerApi();
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSetup = useCallback(async () => {
    try {
      const data = await api.getClientSetup();
      setConfig(data);
    } catch {
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchSetup();
  }, [fetchSetup]);

  if (loading) {
    return (
      <div style={{ padding: 24, color: 'var(--text-dim)', textAlign: 'center', paddingTop: 60 }}>Cargando...</div>
    );
  }

  if (!config) {
    return (
      <div style={{ padding: 24, color: '#ef4444', textAlign: 'center', paddingTop: 60 }}>
        No se pudo cargar la configuración del cliente
      </div>
    );
  }

  const hostname = config.hostname;

  const cards: ProtocolCard[] = [
    {
      icon: <Inbox size={16} style={{ color: 'var(--amber)' }} />,
      title: 'IMAP',
      settings: [
        { label: 'Servidor', value: hostname },
        { label: 'Puerto', value: '993' },
        { label: 'Seguridad', value: 'SSL/TLS' },
      ],
    },
    {
      icon: <Mail size={16} style={{ color: 'var(--amber)' }} />,
      title: 'SMTP',
      settings: [
        { label: 'Servidor', value: hostname },
        { label: 'Puerto (recomendado)', value: '465' },
        { label: 'Seguridad', value: 'SSL/TLS' },
        { label: 'Puerto (alternativo)', value: '587' },
        { label: 'Seguridad (alternativo)', value: 'STARTTLS' },
      ],
    },
    {
      icon: <ArrowUpDown size={16} style={{ color: 'var(--amber)' }} />,
      title: 'POP3',
      settings: [
        { label: 'Servidor', value: hostname },
        { label: 'Puerto', value: '995' },
        { label: 'Seguridad', value: 'SSL/TLS' },
      ],
    },
    {
      icon: <Globe size={16} style={{ color: 'var(--amber)' }} />,
      title: 'Webmail',
      settings: [{ label: 'URL', value: `https://${hostname}` }],
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '1.125rem' }}>
          Configuración de cliente
        </span>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 6 }}>
          Datos de conexión para configurar clientes de correo (Thunderbird, Outlook, etc.)
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {cards.map((card) => (
          <ProtocolCardComponent key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}
