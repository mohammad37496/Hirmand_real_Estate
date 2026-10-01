import { getBearerToken } from "@/lib/auth/client";

export function customerFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const token = getBearerToken();
  if (token) headers.set("Authorization", "Bearer " + token);
  return fetch(input, {
    ...init,
    headers,
    credentials: init?.credentials ?? "same-origin",
  });
}
