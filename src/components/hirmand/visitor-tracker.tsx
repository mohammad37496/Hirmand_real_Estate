import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";

export function VisitorTracker() {
  const location = useLocation();
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    const pathname = window.location.pathname;

    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    const send = (payload: Record<string, string>) => {
      void fetch("/api/analytics/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({ path: pathname, ...payload }),
      }).catch(() => {
        // Analytics must never interfere with site navigation.
      });
    };

    const key = pathname;
    if (trackedRef.current !== key) {
      trackedRef.current = key;
      send({});
      
      const propertyMatch = pathname.match(/^\/properties\/([^/]+)$/);
      const propertySlug = propertyMatch?.[1];
      if (propertySlug) {
        send({ event: "property_view", propertySlug });
      }
    }

    const heartbeat = () => {
      if (document.visibilityState === "visible") send({ event: "heartbeat" });
    };

    const interval = window.setInterval(heartbeat, 60_000);
    document.addEventListener("visibilitychange", heartbeat);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [location.pathname]);

  return null;
}
