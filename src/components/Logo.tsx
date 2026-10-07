interface LogoProps {
  className?: string;
  /** draw the wordmark next to the mark */
  wordmark?: boolean;
}

/** Monochrome rainbow arching over a link. One colour only: currentColor. */
export function Logo({ className, wordmark = true }: LogoProps) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
      <svg
        viewBox="0 0 48 34"
        role="img"
        aria-label="index."
        style={{ width: "2.6rem", height: "auto", overflow: "visible" }}
      >
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <path d="M3.5 30A20.5 20.5 0 0 1 44.5 30" strokeWidth="2.2" opacity="0.95" />
          <path d="M7 30A17 17 0 0 1 41 30" strokeWidth="2" opacity="0.6" />
          <path d="M10.5 30A13.5 13.5 0 0 1 37.5 30" strokeWidth="1.8" opacity="0.36" />
          <path d="M14 30A10 10 0 0 1 34 30" strokeWidth="1.6" opacity="0.18" />
        </g>
        <g transform="translate(24 21.5) scale(0.78) translate(-12 -12)">
          <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="7" stroke="var(--color-paper)">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </g>
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </g>
        </g>
        <circle cx="24" cy="31.5" r="1.3" fill="currentColor" />
      </svg>
      {wordmark ? (
        <span className="font-display text-[2.05rem] leading-none tracking-[-0.01em]">index.</span>
      ) : null}
    </span>
  );
}
