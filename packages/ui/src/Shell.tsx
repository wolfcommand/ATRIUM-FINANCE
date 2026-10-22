import type { CSSProperties, ReactNode } from "react";
import { wolfTokens as t } from "./tokens.js";

export function WolfShell(props: {
  brand?: string;
  nav?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <a href="/" style={brandStyle}>
          {props.brand ?? "Wolf Intelligence"}
        </a>
        <nav style={navStyle}>{props.nav}</nav>
      </header>
      <div style={bodyStyle}>{props.children}</div>
      {props.footer ? <footer style={footerStyle}>{props.footer}</footer> : null}
    </div>
  );
}

const rootStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  fontFamily: t.font.body,
  color: t.color.paper,
  background: `
    radial-gradient(1200px 600px at 10% -10%, rgba(15,118,110,0.45), transparent 55%),
    radial-gradient(900px 500px at 90% 0%, rgba(51,65,85,0.55), transparent 50%),
    linear-gradient(165deg, #071018 0%, #0f1c2e 48%, #0b3b36 100%)
  `,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: t.space.md,
  padding: `${t.space.md} ${t.space.lg}`,
  borderBottom: `1px solid rgba(244,247,251,0.12)`,
};

const brandStyle: CSSProperties = {
  fontFamily: t.font.display,
  fontSize: "1.35rem",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  color: t.color.paper,
  textDecoration: "none",
};

const navStyle: CSSProperties = {
  display: "flex",
  gap: t.space.md,
  alignItems: "center",
  flexWrap: "wrap",
};

const bodyStyle: CSSProperties = {
  flex: 1,
  width: "100%",
  maxWidth: 1080,
  margin: "0 auto",
  padding: `${t.space.xl} ${t.space.lg}`,
};

const footerStyle: CSSProperties = {
  padding: `${t.space.md} ${t.space.lg}`,
  opacity: 0.65,
  fontSize: "0.875rem",
  borderTop: `1px solid rgba(244,247,251,0.1)`,
};
