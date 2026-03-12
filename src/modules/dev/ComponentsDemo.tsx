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

import { useState } from 'react';
import { StickyNote, Calendar, Trash, Pencil, Copy, ExternalLink, Mail, FolderOpen } from 'lucide-react';
import { SplitPane } from '@/components/shared/SplitPane';
import { AvatarInitials } from '@/components/shared/AvatarInitials';
import { Tag } from '@/components/shared/Tag';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { Tabs } from '@/components/shared/Tabs';
import { SourceBadge } from '@/components/shared/SourceBadge';

const sectionStyle: React.CSSProperties = {
  padding: 24,
  borderBottom: '1px solid var(--border)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: 16,
  color: 'var(--text)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  marginBottom: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  marginBottom: 8,
};

export function Component() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmVariant, setConfirmVariant] = useState<'danger' | 'warning' | 'default'>('default');
  const [activeTab, setActiveTab] = useState('tab1');
  const [activeTabPill, setActiveTabPill] = useState('tab1');

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', overflow: 'auto', height: '100%' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>
        Shared Components Demo
      </h1>
      <p style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', marginBottom: 32 }}>
        Visual reference for all shared components. Only visible in development.
      </p>

      {/* SplitPane */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>SplitPane — 2 columns</h2>
        <div style={{ height: 200, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <SplitPane defaultSizes={[30, 70]} minSizes={[100, 200]}>
            <div style={{ padding: 16, background: 'var(--surface)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Left panel (30%)</p>
            </div>
            <div style={{ padding: 16, background: 'var(--card)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Right panel (70%)</p>
            </div>
          </SplitPane>
        </div>

        <h2 style={{ ...titleStyle, marginTop: 24 }}>SplitPane — 3 columns</h2>
        <div style={{ height: 200, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <SplitPane defaultSizes={[25, 50, 25]} minSizes={[80, 150, 80]}>
            <div style={{ padding: 16, background: 'var(--surface)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Panel 1</p>
            </div>
            <div style={{ padding: 16, background: 'var(--card)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Panel 2</p>
            </div>
            <div style={{ padding: 16, background: 'var(--surface)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Panel 3</p>
            </div>
          </SplitPane>
        </div>
      </div>

      {/* AvatarInitials */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>AvatarInitials</h2>
        <div style={labelStyle}>Sizes: sm, md, lg</div>
        <div style={rowStyle}>
          <AvatarInitials name="Juan García" size="sm" />
          <AvatarInitials name="Juan García" size="md" />
          <AvatarInitials name="Juan García" size="lg" />
          <AvatarInitials name="Ana" size="md" />
          <AvatarInitials name="María del Carmen" size="md" />
          <AvatarInitials name="Pedro Sánchez" size="md" />
          <AvatarInitials name="Alice Johnson" size="md" />
          <AvatarInitials name="Bob Brown" size="md" />
        </div>
      </div>

      {/* Tag */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>Tag</h2>
        <div style={labelStyle}>Filled variant</div>
        <div style={rowStyle}>
          <Tag label="React" color="var(--info)" />
          <Tag label="TypeScript" color="var(--mod-calendar)" />
          <Tag label="Important" color="var(--error)" />
          <Tag label="Removable" color="var(--amber)" removable onRemove={() => {}} />
        </div>
        <div style={labelStyle}>Outline variant</div>
        <div style={rowStyle}>
          <Tag label="React" color="var(--info)" variant="outline" />
          <Tag label="TypeScript" color="var(--mod-calendar)" variant="outline" />
          <Tag label="Removable" color="var(--amber)" variant="outline" removable onRemove={() => {}} />
        </div>
        <div style={labelStyle}>Small size</div>
        <div style={rowStyle}>
          <Tag label="sm filled" color="var(--success)" size="sm" />
          <Tag label="sm outline" color="var(--success)" size="sm" variant="outline" />
        </div>
      </div>

      {/* EmptyState */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>EmptyState</h2>
        <div style={{ height: 280, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <EmptyState
            icon={StickyNote}
            title="No notes yet"
            description="Create your first note or connect a sync provider to import existing notes."
            actions={[
              { label: '+ Create Note', onClick: () => {}, variant: 'primary' },
              { label: 'Connect Provider', onClick: () => {}, variant: 'secondary' },
            ]}
          />
        </div>
      </div>

      {/* ConfirmDialog */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>ConfirmDialog</h2>
        <div style={rowStyle}>
          <button
            onClick={() => { setConfirmVariant('default'); setConfirmOpen(true); }}
            style={{ padding: '6px 12px', background: 'var(--amber)', color: '#06060a', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}
          >
            Default
          </button>
          <button
            onClick={() => { setConfirmVariant('danger'); setConfirmOpen(true); }}
            style={{ padding: '6px 12px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}
          >
            Danger
          </button>
          <button
            onClick={() => { setConfirmVariant('warning'); setConfirmOpen(true); }}
            style={{ padding: '6px 12px', background: 'var(--warning)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)' }}
          >
            Warning
          </button>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {}}
          title={confirmVariant === 'danger' ? 'Delete note?' : confirmVariant === 'warning' ? 'Archive item?' : 'Confirm action?'}
          description={confirmVariant === 'danger' ? 'This action cannot be undone. The note will be permanently deleted.' : 'Are you sure you want to proceed?'}
          confirmLabel={confirmVariant === 'danger' ? 'Delete' : 'Confirm'}
          variant={confirmVariant}
        />
      </div>

      {/* ContextMenu */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>ContextMenu</h2>
        <ContextMenu
          trigger={
            <div style={{ padding: 24, border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8125rem', cursor: 'context-menu' }}>
              Right-click here to see the context menu
            </div>
          }
          items={[
            { label: 'Open', icon: ExternalLink, onClick: () => {}, shortcut: 'Enter' },
            { label: 'Rename', icon: Pencil, onClick: () => {}, shortcut: 'F2' },
            { label: 'Copy', icon: Copy, onClick: () => {}, shortcut: '⌘C' },
            { label: '', icon: undefined, onClick: () => {}, separator: true },
            { label: 'Delete', icon: Trash, onClick: () => {}, variant: 'danger', shortcut: 'Del' },
          ]}
        />
      </div>

      {/* Tabs */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>Tabs — Underline</h2>
        <Tabs
          tabs={[
            { id: 'tab1', label: 'All', icon: FolderOpen, badge: 12 },
            { id: 'tab2', label: 'Recent', icon: Calendar },
            { id: 'tab3', label: 'Starred' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="underline"
        />

        <h2 style={{ ...titleStyle, marginTop: 24 }}>Tabs — Pills</h2>
        <Tabs
          tabs={[
            { id: 'tab1', label: 'All', badge: 5 },
            { id: 'tab2', label: 'Inbox', icon: Mail },
            { id: 'tab3', label: 'Sent' },
          ]}
          activeTab={activeTabPill}
          onChange={setActiveTabPill}
          variant="pills"
        />
      </div>

      {/* SourceBadge */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>SourceBadge</h2>
        <div style={labelStyle}>Size: md (default)</div>
        <div style={rowStyle}>
          <SourceBadge source="local" />
          <SourceBadge source="google" />
          <SourceBadge source="apple" />
          <SourceBadge source="synology" />
          <SourceBadge source="imap" />
          <SourceBadge source="custom-source" />
        </div>
        <div style={labelStyle}>Size: sm (icon only, tooltip on hover)</div>
        <div style={rowStyle}>
          <SourceBadge source="local" size="sm" />
          <SourceBadge source="google" size="sm" />
          <SourceBadge source="apple" size="sm" />
          <SourceBadge source="synology" size="sm" />
          <SourceBadge source="imap" size="sm" />
        </div>
      </div>
    </div>
  );
}
