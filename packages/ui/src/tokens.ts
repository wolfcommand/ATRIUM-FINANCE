/** Wolf design tokens — Phase 2 shell (not a full design system yet). */
export const wolfTokens = {
  color: {
    ink: "#0b1220",
    paper: "#f4f7fb",
    mist: "#d7e0ec",
    teal: "#0f766e",
    tealDeep: "#115e59",
    steel: "#334155",
    danger: "#b91c1c",
    ok: "#15803d",
  },
  font: {
    display: '"Fraunces", "Iowan Old Style", "Palatino Linotype", Palatino, serif',
    body: '"Source Sans 3", "Source Sans Pro", "Segoe UI", sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
  },
  space: {
    xs: "0.35rem",
    sm: "0.65rem",
    md: "1rem",
    lg: "1.75rem",
    xl: "2.75rem",
  },
  radius: {
    sm: "6px",
    md: "10px",
  },
} as const;

export type WolfTokens = typeof wolfTokens;
