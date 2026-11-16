// The Docent mark on its own — the app-icon glyph, no wordmark. Sizes from
// the caller's className. Two-token fill, shared with the wordmark below: the
// body takes `--sl-brand-mark` (the theme's primary text, so white on dark and
// near-black on light) and the dot takes the theme's accent, which is what keeps
// the glyph reading as two parts rather than one flat shape.
export const LogoMark = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label="Docent"
  >
    <path
      d="M10 5H11A6 6 0 0 1 17 11V18H10A6 6 0 0 1 4 12V11A6 6 0 0 1 10 5Z"
      fill="var(--sl-brand-mark)"
    />
    <circle cx="16.7" cy="8.4" r="3" fill="var(--sl-brand-primary)" />
  </svg>
);

// The Docent wordmark — "docent" in the theme's primary text with the accent
// dot, matching the sidebar and splash wordmarks. Sizes from the caller's
// className (the viewBox does the scaling), and takes its fill from the theme
// rather than a baked-in white — see `--sl-brand-mark` in themes.ts.
export const Logo = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 132 33"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label="Docent"
  >
    <text
      x="0"
      y="24"
      fontFamily="inherit"
      fontSize="30"
      fontWeight="600"
      letterSpacing="-0.5"
      fill="var(--sl-brand-mark)"
    >
      docent
    </text>
    <circle cx="124" cy="22" r="4" fill="var(--sl-brand-primary)" />
  </svg>
);
