/**
 * Admin behaviour helpers.
 *
 * Kept apart from `admin-ui.tsx` on purpose: that file renders the shared
 * dialog / skeleton / pagination components and should export components
 * only, otherwise React Fast Refresh has to fall back to a full reload every
 * time an admin-only file is edited while developing.
 */
import { useCallback, useRef, useState, type ReactNode } from "react";
import { AdminConfirmDialog } from "@/components/hirmand/admin-ui";

/* ------------------------------------------------------------------ */
/* Busy guard — one submit per operation, even on a double click.      */
/* ------------------------------------------------------------------ */

/**
 * Wraps an async action so a second click while the first is still in flight
 * is ignored instead of firing a duplicate mutation. `pending` re-renders
 * callers so they can disable their own button.
 */
export function useGuardedAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<void>,
) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (...args: Args) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(true);
      try {
        await action(...args);
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [action],
  );

  return { run, pending };
}

/* ------------------------------------------------------------------ */
/* Confirmation dialog                                                 */
/* ------------------------------------------------------------------ */

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  /** Bullet list rendered inside the dialog — used for bulk operations. */
  items?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

export type ConfirmRequest = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * Promise-based confirm so call sites read as
 * `if (!(await confirm({...}))) return;` instead of every component owning
 * its own modal markup. Renders nothing until a request exists.
 */
export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ ...options, resolve });
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    setRequest((current) => {
      current?.resolve(ok);
      return null;
    });
  }, []);

  const dialog = request ? (
    <AdminConfirmDialog request={request} onSettle={settle} />
  ) : null;

  return { confirm, dialog };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const FA = new Intl.NumberFormat("fa-IR");

export function fa(value: number): string {
  return FA.format(Number.isFinite(value) ? value : 0);
}

export function faBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "۰ بایت";
  if (bytes < 1024) return `${fa(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${fa(Math.round(bytes / 1024))} کیلوبایت`;
  return `${(bytes / 1024 / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
}

/** Turns any thrown value into a Persian, non-technical message. */
export function adminErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
