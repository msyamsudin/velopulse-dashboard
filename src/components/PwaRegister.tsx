'use client';

import { useEffect } from 'react';

/**
 * Registers the offline service worker. Skipped in development so hot reload
 * and the Next dev server are never shadowed by a stale cache.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration is best-effort; the app works fine without a SW.
    });
  }, []);

  return null;
}
