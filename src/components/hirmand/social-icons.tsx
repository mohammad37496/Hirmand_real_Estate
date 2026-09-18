type IconProps = {
  size?: number;
  className?: string;
};

const svgProps = (size: number, className?: string) => ({
  viewBox: "0 0 24 24",
  width: size,
  height: size,
  fill: "none",
  className,
  "aria-hidden": true as const,
});

export function InstagramIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.15" cy="6.85" r="1.05" fill="currentColor" />
    </svg>
  );
}

export function TelegramIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path
        d="M20.4 4.6 3.8 11.05c-.72.28-.71.78.1.96l4.08 1.27 1.58 5.12c.2.66.6.8 1.08.44l2.28-1.86 3.86 2.84c.56.32.96.15 1.1-.52l2.86-13.18c.2-.84-.32-1.22-.94-.76Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="m9.9 13.15 8.35-5.35-6.2 7.05-.35 3.05" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path
        d="M12.05 3.6A8.4 8.4 0 0 0 4.4 16.15L3.7 20.3l4.25-.82A8.4 8.4 0 1 0 12.05 3.6Z"
        stroke="currentColor"
        strokeWidth="1.65"
      />
      <path
        d="M8.7 9.35c.18-.4.36-.42.62-.42h.42c.14 0 .32 0 .48.38.18.44.66 1.6.72 1.72.06.12.1.26.02.4-.08.16-.14.26-.26.4-.12.14-.26.3-.38.4-.12.12-.24.24-.1.44.2.38.48.78.82 1.2.54.66 1.2 1.1 1.72 1.42.14.08.3.06.4-.06.12-.18.44-.5.54-.66.1-.16.22-.14.38-.08.16.06 1.04.48 1.22.58.18.08.3.12.34.2.04.08.04.44-.16 1-.18.52-1.12 1.02-1.58 1.1-.42.06-.94.1-1.52-.1-.36-.12-.8-.26-1.38-.5-2.4-1.04-3.96-3.46-4.08-3.62-.12-.16-.96-1.28-.96-2.44 0-1.16.6-1.74.8-1.98Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function EitaaIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M9.15 14.7c.55 1.85 1.72 2.85 3.2 2.85 2.15 0 3.6-1.82 3.6-4.35 0-2.48-1.42-4.2-3.52-4.2-1.28 0-2.4.72-3.02 1.95"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M8.7 12.15h6.55" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
