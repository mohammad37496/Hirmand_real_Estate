import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";

export function VisitorTracker() {
  const location = useLocation();
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${location.pathname}${location.search}`;
    const pathname = window.location.pathname;

    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;
    if (trackedRef.current === key) return;

    trackedRef.current = key;

    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {
      // Analytics must never interfere with site navigation.
    });
  }, [location.pathname, location.search]);

  return null;
}
