type IconProps = {
  className?: string;
  size?: number | string;
  strokeWidth?: number;
};

function Svg({
  className,
  size = "1em",
  strokeWidth = 1.5,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 1.9" />
  </Svg>
);

export const IconHourglass = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 3h10M7 21h10" />
    <path d="M7 3v3.5a5 5 0 0 0 2.6 4.4L12 12l-2.4 1.1A5 5 0 0 0 7 17.5V21" />
    <path d="M17 3v3.5a5 5 0 0 1-2.6 4.4L12 12l2.4 1.1a5 5 0 0 1 2.6 4.4V21" />
  </Svg>
);

export const IconGlobe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
  </Svg>
);

export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2" />
    <path d="M17.2 14.2A5.5 5.5 0 0 1 20.5 19" />
  </Svg>
);

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16" />
    <path d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
    <path d="M6.5 7l.8 12.1A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
  </Svg>
);

export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
  </Svg>
);

export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" />
  </Svg>
);

export const IconArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7" />
    <path d="M9 7h8v8" />
  </Svg>
);

export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="m20 4-8.5 8.5" />
    <path d="M19 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 19V7a1.5 1.5 0 0 1 1.5-1.5H10" />
  </Svg>
);

export const IconSpark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
    <path d="M18.5 16.5 19.2 18l1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7.7-1.5Z" />
  </Svg>
);

export const IconFlame = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3s4.5 3.6 4.5 8a4.5 4.5 0 0 1-9 0c0-1.4.5-2.6 1.2-3.6.2 1.3.9 2.1 1.8 2.1 1.1 0 1.5-1 1.5-2.4C12 5.6 12 4.3 12 3Z" />
    <path d="M12 21a7 7 0 0 0 7-7" />
    <path d="M5 14a7 7 0 0 0 7 7" />
  </Svg>
);

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V6l-7-3Z" />
    <path d="m9.2 12 2 2 3.6-3.6" />
  </Svg>
);

export const IconQuestion = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.5" />
    <path d="M12 17.2h.01" />
  </Svg>
);

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconMonitor = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M9 21h6" />
    <path d="M12 17v4" />
  </Svg>
);

export const IconShare = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="2.4" />
    <circle cx="17.5" cy="6" r="2.4" />
    <circle cx="17.5" cy="18" r="2.4" />
    <path d="m8.1 10.9 7.3-3.8M8.1 13.1l7.3 3.8" />
  </Svg>
);

export const IconLanguage = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 5.5h9" />
    <path d="M7.5 3.5v2" />
    <path d="M10 5.5c0 3.6-2.6 7-6 8.5" />
    <path d="M5 9.8c1 2 2.9 3.6 5 4.4" />
    <path d="m12.5 20.5 4-10 4 10" />
    <path d="M13.9 17.3h5.2" />
  </Svg>
);

export const IconCoin = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v9" />
    <path d="M14.3 9.6a2.6 2.6 0 0 0-2.3-1.2c-1.4 0-2.4.8-2.4 1.9 0 2.6 5 1.4 5 4 0 1.2-1.1 2-2.6 2a2.8 2.8 0 0 1-2.5-1.3" />
  </Svg>
);

export const IconSignal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 18.5v-4" />
    <path d="M10 18.5v-8" />
    <path d="M14.5 18.5v-11" />
    <path d="M19 18.5v-14" />
  </Svg>
);

export const IconWifiOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4.5 20.5 21" />
    <path d="M2.5 9.2a16 16 0 0 1 4.6-2.8" />
    <path d="M11 5.1a16 16 0 0 1 10.5 4.1" />
    <path d="M5.6 12.6a11 11 0 0 1 2.6-1.7" />
    <path d="M15.6 11.4a11 11 0 0 1 2.8 1.9" />
    <path d="M9 15.9a6 6 0 0 1 5.3.6" />
    <path d="M12 19.5h.01" />
  </Svg>
);

export const IconArchive = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
    <path d="M5 8.5V18a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18V8.5" />
    <path d="M10 12h4" />
  </Svg>
);

export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </Svg>
);

export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 10.5 8-6.5 8 6.5" />
    <path d="M6.5 9.3V19a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9.3" />
  </Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.5 2.8 20h18.4L12 4.5Z" />
    <path d="M12 10v4" />
    <path d="M12 17.2h.01" />
  </Svg>
);
