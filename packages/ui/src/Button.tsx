import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { wolfTokens as t } from "./tokens.js";

type Variant = "primary" | "ghost" | "danger";

export function WolfButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant },
) {
  const { variant = "primary", style, ...rest } = props;
  return <button type="button" {...rest} style={{ ...base, ...variants[variant], ...style }} />;
}

const base: CSSProperties = {
  fontFamily: t.font.body,
  fontWeight: 600,
  fontSize: "0.95rem",
  padding: "0.65rem 1.1rem",
  borderRadius: t.radius.sm,
  border: "1px solid transparent",
  cursor: "pointer",
};

const variants: Record<Variant, CSSProperties> = {
  primary: {
    background: t.color.paper,
    color: t.color.ink,
  },
  ghost: {
    background: "transparent",
    color: t.color.paper,
    borderColor: "rgba(244,247,251,0.28)",
  },
  danger: {
    background: "rgba(185,28,28,0.2)",
    color: "#fecaca",
    borderColor: "rgba(254,202,202,0.35)",
  },
};
