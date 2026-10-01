import { useEffect, useRef } from "react";
import { getBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const FAVORITES_KEY = "hirmand-favorite-properties";
const SAVED_SEARCHES_KEY = "hirmand-saved-searches";

function readArray(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function accountFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const token = getBearerToken();
  if (token) headers.set("Authorization", "Bearer " + token);
  return fetch(path, { ...init, headers, credentials: "same-origin" });
}

export function CustomerAccountSync() {
  const { user, isPending } = useCurrentUserState();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (isPending || !user || lastUserId.current === user.id) return;
    lastUserId.current = user.id;

    void (async () => {
      await accountFetch("/api/customer-account-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => undefined);

      const favoriteSlugs = readArray(FAVORITES_KEY)
        .filter((item): item is string => typeof item === "string")
        .slice(0, 100);

      if (favoriteSlugs.length) {
        await accountFetch("/api/customer-favorites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "sync", slugs: favoriteSlugs }),
        }).catch(() => undefined);
      }

      const saved = readArray(SAVED_SEARCHES_KEY)
        .filter((item): item is { id: string; name: string; params: string } =>
          Boolean(
            item &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            typeof item.params === "string",
          ),
        )
        .slice(0, 10);

      if (saved.length) {
        await accountFetch("/api/saved-searches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "sync",
            items: saved.map((item) => ({
              clientId: item.id,
              name: item.name,
              params: item.params,
            })),
          }),
        }).catch(() => undefined);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("hirmand:account-synced"));
      }
    })();
  }, [isPending, user]);

  return null;
}
