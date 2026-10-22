import type { CSSProperties, ReactNode } from "react";
import { wolfTokens as t } from "./tokens";

export function WolfAppTile(props: {
  title: string;
  subtitle?: string;
  state: "open" | "locked" | "soon";
  action?: ReactNode;
}) {
  return (
    <div style={tileStyle}>
      <div>
        <div style={titleStyle}>{props.title}</div>
        {props.subtitle ? <div style={subStyle}>{props.subtitle}</div> : null}
      </div>
      <div style={actionRow}>
        {props.state === "soon" ? <span style={badgeSoon}>Coming soon</span> : null}
        {props.state === "locked" ? <span style={badgeLocked}>Locked</span> : null}
        {props.action}
      </div>
    </div>
  );
}

const tileStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: t.space.md,
  padding: `${t.space.md} ${t.space.lg}`,
  borderRadius: t.radius.md,
  background: "rgba(244,247,251,0.06)",
  border: "1px solid rgba(244,247,251,0.12)",
};

const titleStyle: CSSProperties = {
  fontFamily: t.font.display,
  fontSize: "1.15rem",
  fontWeight: 600,
};

const subStyle: CSSProperties = {
  marginTop: 4,
  opacity: 0.75,
  fontSize: "0.9rem",
};

const actionRow: CSSProperties = {
  display: "flex",
  gap: t.space.sm,
  alignItems: "center",
  flexWrap: "wrap",
};

const badgeSoon: CSSProperties = {
  fontSize: "0.75rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  opacity: 0.7,
};

const badgeLocked: CSSProperties = {
  fontSize: "0.75rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#fde68a",
};
