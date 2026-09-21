import type { ErrorComponentProps } from "@tanstack/react-router";
import { Home, RefreshCw, TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "خطایی در بارگذاری این صفحه رخ داد. لطفاً دوباره تلاش کنید.";

function errorMessage(error: unknown): string {
  if (import.meta.env.DEV) {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error) return error;
  }
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-black" dir="rtl">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center gap-5 text-center">
        <span
          className="grid size-16 place-items-center rounded-full border border-black/15 bg-black/[.04] text-black"
          aria-hidden="true"
        >
          <TriangleAlert className="size-8" strokeWidth={1.8} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">خطایی رخ داد</h1>
          <p className="mt-2 break-words text-sm leading-7 text-black/60">{errorMessage(error)}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white"
            onClick={() => reset()}
          >
            <RefreshCw className="size-4" />
            تلاش دوباره
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-semibold text-black"
          >
            <Home className="size-4" />
            بازگشت به خانه
          </a>
        </div>
      </div>
    </main>
  );
}
