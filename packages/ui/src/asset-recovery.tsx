'use client';

import { useEffect } from 'react';

// Mobile browsers can restore a document while its stylesheet/image requests
// remain failed. Repair those resources without remounting the shopping UI.
export function AssetRecovery() {
  useEffect(() => {
    const sheets = new Map<string, HTMLLinkElement>();
    let imageAttempts = new WeakMap<HTMLImageElement, { source: string; time: number }>();
    const reloadKey = 'gupta-mart:asset-reload';
    let disposed = false;
    let repairing = false;
    let timer: ReturnType<typeof setTimeout>;

    function rememberStyles() {
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((link) => {
        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin || link.disabled) return;
        url.searchParams.delete('gm-retry');
        sheets.set(url.href, link);
      });
    }

    function hasStyles(link: HTMLLinkElement) {
      if (!link.isConnected || !link.sheet) return false;
      try {
        return link.sheet.cssRules.length > 0;
      } catch {
        // A browser may restrict CSSOM inspection even for a loaded sheet.
        return true;
      }
    }

    function retryStyle(href: string, original: HTMLLinkElement) {
      return new Promise<boolean>((resolve) => {
        const link = original.isConnected
          ? original
          : (original.cloneNode(false) as HTMLLinkElement);
        const url = new URL(href);
        url.searchParams.set('gm-retry', String(Date.now()));
        const timeout = setTimeout(() => finish(false), 8000);
        const finish = (ok: boolean) => {
          clearTimeout(timeout);
          link.removeEventListener('load', loaded);
          link.removeEventListener('error', failed);
          resolve(ok);
        };
        const loaded = () => finish(hasStyles(link));
        const failed = () => finish(false);
        link.addEventListener('load', loaded);
        link.addEventListener('error', failed);
        link.href = url.href;
        if (!link.isConnected) {
          // Keep the original cascade when only an earlier stylesheet vanished.
          const entries = [...sheets];
          const index = entries.findIndex(([key]) => key === href);
          const next = entries
            .slice(index + 1)
            .find(([, sheet]) => sheet.parentNode === document.head);
          document.head.insertBefore(link, next?.[1] ?? null);
        }
        sheets.set(href, link);
      });
    }

    function retryImages() {
      document.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
        const source = image.currentSrc || image.src;
        if (!source || !image.complete || image.naturalWidth > 0) return;
        const attempt = imageAttempts.get(image);
        if (attempt?.source === source && Date.now() - attempt.time < 30000) return;
        imageAttempts.set(image, { source, time: Date.now() });
        // Preserve signed image URLs and responsive-image attributes.
        const src = image.getAttribute('src');
        const srcset = image.getAttribute('srcset');
        image.removeAttribute('srcset');
        image.removeAttribute('src');
        if (srcset !== null) image.setAttribute('srcset', srcset);
        if (src !== null) image.setAttribute('src', src);
      });
    }

    async function recover() {
      if (disposed || repairing || document.hidden || !navigator.onLine) return;
      rememberStyles();
      retryImages();
      const missing = [...sheets].filter(([, link]) => !link.disabled && !hasStyles(link));
      if (!missing.length) return;
      repairing = true;
      try {
        const repaired = await Promise.all(missing.map(([href, link]) => retryStyle(href, link)));
        if (repaired.every(Boolean) || disposed || document.hidden || !navigator.onLine) return;
        // An old tab may reference a CSS file removed by a newer deployment.
        // Verify that fresh HTML is reachable before a single guarded reload.
        const fingerprint = [...sheets.keys()].sort().join('|');
        if (sessionStorage.getItem(reloadKey) === fingerprint) return;
        // Development servers and rapid deployments may change the URL on every
        // reload. A second, time-based guard prevents a new fingerprint looping.
        const lastReload = Number(sessionStorage.getItem(`${reloadKey}:at`) || 0);
        if (Date.now() - lastReload < 60000) return;
        const response = await fetch(location.href, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: AbortSignal.timeout(8000),
        });
        if (
          disposed ||
          document.hidden ||
          !navigator.onLine ||
          !response.ok ||
          !response.headers.get('content-type')?.includes('text/html')
        )
          return;
        sessionStorage.setItem(reloadKey, fingerprint);
        sessionStorage.setItem(`${reloadKey}:at`, String(Date.now()));
        location.reload();
      } catch {
        // Offline networks and unavailable storage must never cause reload loops.
      } finally {
        repairing = false;
      }
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => void recover(), 150);
    }

    function reconnect() {
      if (document.hidden) return;
      imageAttempts = new WeakMap();
      schedule();
    }

    rememberStyles();
    if (document.readyState === 'complete') schedule();
    window.addEventListener('load', schedule);
    window.addEventListener('pageshow', reconnect);
    window.addEventListener('online', reconnect);
    document.addEventListener('visibilitychange', reconnect);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener('load', schedule);
      window.removeEventListener('pageshow', reconnect);
      window.removeEventListener('online', reconnect);
      document.removeEventListener('visibilitychange', reconnect);
    };
  }, []);

  return null;
}
