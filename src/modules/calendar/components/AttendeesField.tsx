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

import { Input } from '@/components/ui/input';
import { fieldLabelStyle } from './event-form';

interface AttendeesFieldProps {
  /** Comma-separated attendee emails, kept as raw text while editing */
  value: string;
  onChange: (value: string) => void;
}

export function AttendeesField({ value, onChange }: AttendeesFieldProps) {
  return (
    <div>
      <label style={fieldLabelStyle}>Attendees (comma-separated emails)</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="alice@example.com, bob@example.com"
      />
    </div>
  );
}
