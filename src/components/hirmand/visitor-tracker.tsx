import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";

export function VisitorTracker() {
  const location = useLocation();
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    const pathname = window.location.pathname;
    const key = pathname;

    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;
    if (trackedRef.current === key) return;

    trackedRef.current = key;

    const propertyMatch = pathname.match(/^\/properties\/([^/]+)$/);
    const propertySlug = propertyMatch?.[1];

    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {
      // Analytics must never interfere with site navigation.
    });

    if (propertySlug) {
      void fetch("/api/analytics/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({
          path: pathname,
          event: "property_view",
          propertySlug,
        }),
      }).catch(() => {
        // Analytics must never interfere with site navigation.
      });
    }
  }, [location.pathname]);

  return null;
}
