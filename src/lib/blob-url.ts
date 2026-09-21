export function normalizePublicBlobUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const delegation = url.searchParams.get("vercel-blob-delegation");

    if (url.hostname.endsWith(".public.blob.vercel-storage.com")) {
      url.search = "";
      url.hash = "";
      return url.toString();
    }

    if (url.hostname === "blob.vercel-storage.com" && delegation) {
      const dot = delegation.indexOf(".");
      if (dot > 0) {
        const payload = JSON.parse(
          Buffer.from(delegation.slice(0, dot), "base64url").toString("utf8"),
        ) as { storeId?: unknown };

        if (typeof payload.storeId === "string" && payload.storeId) {
          const storeId = payload.storeId.startsWith("store_")
            ? payload.storeId.slice("store_".length)
            : payload.storeId;
          return `https://${storeId}.public.blob.vercel-storage.com${url.pathname}`;
        }
      }
    }

    return raw;
  } catch {
    return raw;
  }
}

export function isPublicBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

export function isPrivateBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".private.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}
