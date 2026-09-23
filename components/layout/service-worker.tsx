"use client";

import { useEffect } from "react";

/**
 * Register the service worker (installability + offline shell). Browsers only allow this
 * on HTTPS or localhost; on plain http://<LAN-IP> it is skipped silently and the app still works.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}
