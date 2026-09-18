import type { MouseEvent } from "react";

export function scrollToId(event: MouseEvent<HTMLAnchorElement>, id: string, onDone?: () => void) {
  event.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
  onDone?.();
}
