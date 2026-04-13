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

/**
 * ObservabilitySection — fused container for Logging + Telemetry +
 * Environment variables.
 *
 * All three are admin-only operational concerns: how the system logs,
 * how it reports metrics/traces, and what env vars it exposes to the
 * Gateway runtime. Lives under the "Administración" group in the
 * sidebar.
 *
 * Children are reused as-is (LoggingSection / TelemetrySection /
 * EnvSection) to keep their existing dirty/save flows intact.
 */

import { useState } from 'react';
import { SettingsBlock } from '../shared/SettingsBlock';
import { LoggingSection } from './LoggingSection';
import { TelemetrySection } from './TelemetrySection';
import { EnvSection } from './EnvSection';

export function ObservabilitySection() {
  const [openLogging, setOpenLogging] = useState(true);
  const [openTelemetry, setOpenTelemetry] = useState(false);
  const [openEnv, setOpenEnv] = useState(false);

  return (
    <div>
      <h2
        style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--text)',
          margin: '0 0 4px 0',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Observability
      </h2>
      <p
        style={{
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          margin: '0 0 16px 0',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Logging, telemetry (OpenTelemetry traces) and Gateway environment variables. Admin only.
      </p>

      <SettingsBlock
        title="Logging"
        description="Levels, presets, redact patterns"
        expanded={openLogging}
        onToggle={() => setOpenLogging((v) => !v)}
      >
        <div style={{ marginTop: 4 }}>
          <LoggingSection />
        </div>
      </SettingsBlock>

      <SettingsBlock
        title="Telemetry"
        description="OpenTelemetry traces & metrics"
        expanded={openTelemetry}
        onToggle={() => setOpenTelemetry((v) => !v)}
      >
        <div style={{ marginTop: 4 }}>
          <TelemetrySection />
        </div>
      </SettingsBlock>

      <SettingsBlock
        title="Environment variables"
        description="Gateway runtime env"
        expanded={openEnv}
        onToggle={() => setOpenEnv((v) => !v)}
      >
        <div style={{ marginTop: 4 }}>
          <EnvSection />
        </div>
      </SettingsBlock>
    </div>
  );
}
