// The Docent mark on its own — the app-icon glyph, no wordmark: the pixel
// lantern from the Docent Studio tile on smartloop.ai, drawn on its 9x9 grid.
// Sizes from the caller's className. Two-token fill, shared with the wordmark
// below: the body takes `--sl-brand-mark` (the theme's primary text, so white
// on dark and near-black on light) and the two panes take the theme's accent,
// which is what keeps the glyph reading as a lit lantern rather than one flat
// shape. `crispEdges` keeps the cells square at the small sizes it is used at.
// The same grid lives in scripts/make-icons.py, which draws the app icons.
export const LogoMark = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 9 9"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    shapeRendering="crispEdges"
    role="img"
    aria-label="Docent"
  >
    <path
      d="M3 0h3v2h2v1h-1v5h1v1h-7v-1h1v-5h-1v-1h2zM4 1v1h1v-1zM3 4v3h1v-3zM5 4v3h1v-3z"
      fillRule="evenodd"
      fill="var(--sl-brand-mark)"
    />
    <path d="M3 4h1v3h-1zM5 4h1v3h-1z" fill="var(--sl-brand-primary)" />
  </svg>
);

// The Docent wordmark — "docent" in the theme's primary text and "studio" beside
// it at the same size in the accent, matching the sidebar and splash wordmarks. Sizes from the caller's
// className (the viewBox does the scaling), and takes its fill from the theme
// rather than a baked-in white — see `--sl-brand-mark` in themes.ts.
export const Logo = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 196 33"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label="Docent Studio"
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
      <tspan dx="7" fill="var(--sl-brand-primary)">studio</tspan>
    </text>
  </svg>
);
