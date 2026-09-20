import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "خطایی در بارگذاری این صفحه رخ داد. لطفاً دوباره تلاش کنید.";

function errorMessage(error: unknown): string {
  if (import.meta.env.DEV) {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error) return error;
  }
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-[#071113] text-[#f4f7f6]"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">خطایی رخ داد</h1>
      <p className="max-w-md text-sm break-words text-[#aab8b7]">
        {errorMessage(error)}
      </p>
    </main>
  );
}
