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
 * Ambient JSX typings for the media-chrome web components used by the
 * video module's PlayerView.
 *
 * media-chrome registers plain custom elements (side-effect import).
 * React 19 renders custom elements natively — we deliberately do NOT use
 * the `media-chrome/react` wrapper (peer-dep mismatch with React 19) —
 * but TypeScript needs the tag names declared in
 * `React.JSX.IntrinsicElements` for tsc to stay at 0 errors.
 *
 * Only the elements (and attributes) actually used by PlayerView are
 * declared; extend here when adding controls.
 */

import type * as React from 'react';

/**
 * Base props for every media-chrome element. HTMLAttributes already
 * covers className/style/slot/children, which is all the chrome needs —
 * element-specific attributes are added per tag below.
 */
type MediaChromeBaseProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'media-controller': MediaChromeBaseProps & {
        /** Disable built-in hotkeys if they ever clash with app shortcuts. */
        nohotkeys?: boolean;
      };
      'media-control-bar': MediaChromeBaseProps;
      'media-play-button': MediaChromeBaseProps;
      'media-seek-backward-button': MediaChromeBaseProps & { seekoffset?: number | string };
      'media-seek-forward-button': MediaChromeBaseProps & { seekoffset?: number | string };
      'media-time-range': MediaChromeBaseProps;
      'media-time-display': MediaChromeBaseProps & {
        /** Render "current / duration" instead of just the current time. */
        showduration?: boolean;
      };
      'media-mute-button': MediaChromeBaseProps;
      'media-volume-range': MediaChromeBaseProps;
      'media-captions-button': MediaChromeBaseProps;
      'media-fullscreen-button': MediaChromeBaseProps;
      'media-loading-indicator': MediaChromeBaseProps & { noautohide?: boolean };
    }
  }
}
