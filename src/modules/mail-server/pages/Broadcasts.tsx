import { useState } from 'react';
import { useMailServerApi } from '@micelclaw/mail-admin-ui';
import { toast } from 'sonner';
import { AlertTriangle, Send } from 'lucide-react';

const primaryBtn: React.CSSProperties = {
  background: 'var(--amber)',
  color: '#000',
  fontWeight: 600,
  border: 'none',
  borderRadius: 'var(--radius-md)',
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: '0.8125rem',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 12px',
  fontSize: '0.875rem',
  width: '100%',
  outline: 'none',
};

export default function Broadcasts() {
  const api = useMailServerApi();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Completa el asunto y el cuerpo del mensaje');
      return;
    }

    setSending(true);
    try {
      const result = await api.sendBroadcast(subject, body);
      toast.success(`Comunicado enviado a ${result.sent_to} buzones`);
      setSubject('');
      setBody('');
    } catch {
      toast.error('Error al enviar el comunicado');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '1.125rem' }}>Enviar comunicado</span>
      </div>

      {/* Warning banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(249, 115, 22, 0.1)',
          border: '1px solid rgba(249, 115, 22, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: 24,
        }}
      >
        <AlertTriangle size={16} style={{ color: '#f97316', flexShrink: 0 }} />
        <span style={{ color: '#f97316', fontSize: '0.875rem' }}>
          Este mensaje se enviará a todos los buzones del servidor
        </span>
      </div>

      {/* Form */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', marginBottom: 6, display: 'block' }}>
              Asunto
            </label>
            <input
              style={inputStyle}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del comunicado"
              disabled={sending}
            />
          </div>
          <div>
            <label style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', marginBottom: 6, display: 'block' }}>
              Cuerpo del mensaje
            </label>
            <textarea
              style={{
                ...inputStyle,
                minHeight: 200,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe el contenido del comunicado..."
              disabled={sending}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim()}
              style={{
                ...primaryBtn,
                opacity: sending || !subject.trim() || !body.trim() ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Send size={14} />
              {sending ? 'Enviando...' : 'Enviar comunicado'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
