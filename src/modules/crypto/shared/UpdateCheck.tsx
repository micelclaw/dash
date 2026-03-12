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
import { RefreshCw, Loader2, Check, ArrowUp } from 'lucide-react';
import { api } from '@/services/api';

interface ImageUpdateInfo {
  current_tag: string;
  latest_tag: string;
  update_available: boolean;
  checked_at: string;
}

interface Props {
  service: string;
  installed: boolean;
  loading: boolean;
}

export function UpdateCheck({ service, installed, loading }: Props) {
  const [updateInfo, setUpdateInfo] = useState<ImageUpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const checkForUpdates = async () => {
    setChecking(true);
    setUpdateError(null);
    try {
      const res = await api.get<{ data: ImageUpdateInfo }>(`/crypto/${service}/check-update`);
      setUpdateInfo(res.data);
    } catch {
      setUpdateError('Could not check for updates');
    } finally {
      setChecking(false);
    }
  };

  const applyUpdate = async () => {
    if (!updateInfo?.latest_tag) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      await api.post(`/crypto/${service}/update`, { tag: updateInfo.latest_tag });
      setUpdateInfo({ ...updateInfo, update_available: false, current_tag: updateInfo.latest_tag });
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  if (!installed || loading) return null;

  return (
    <div className="btc-update-section">
      {!updateInfo && !checking && !updateError && (
        <button className="btc-update-link" onClick={checkForUpdates}>
          <RefreshCw size={11} /> Check for updates
        </button>
      )}
      {checking && (
        <span className="btc-update-status">
          <Loader2 size={11} className="spin" /> Checking...
        </span>
      )}
      {updateInfo && !updateInfo.update_available && (
        <span className="btc-update-status">
          <Check size={11} style={{ color: '#22c55e' }} /> {updateInfo.current_tag} — up to date
        </span>
      )}
      {updateInfo?.update_available && !updating && (
        <div className="btc-update-available">
          <span><ArrowUp size={11} /> Update: {updateInfo.current_tag} → {updateInfo.latest_tag}</span>
          <button className="btc-update-btn" onClick={applyUpdate}>Update</button>
        </div>
      )}
      {updating && (
        <span className="btc-update-status">
          <Loader2 size={11} className="spin" /> Updating to {updateInfo?.latest_tag}...
        </span>
      )}
      {updateError && (
        <div className="btc-update-error">
          <span>{updateError}</span>
          <button className="btc-update-link" onClick={checkForUpdates} style={{ marginLeft: 8 }}>Retry</button>
        </div>
      )}
    </div>
  );
}
