import { useEffect, useRef } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function CustomerAccountSync() {
  const { user, isPending } = useCurrentUserState();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (isPending || !user || lastUserId.current === user.id) return;
    lastUserId.current = user.id;
    void fetch("/api/customer-account-link", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => undefined);
  }, [isPending, user]);

  return null;
}
