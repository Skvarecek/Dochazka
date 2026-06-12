"use client";

import { useEffect } from "react";

// Registruje service worker (kvůli instalovatelnosti PWA). Bezpečné: SW jen
// průchozí, nic necachuje.
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
