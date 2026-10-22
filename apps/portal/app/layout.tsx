import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Wolf Intelligence",
  description: "Group portal launcher (placeholder)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "linear-gradient(160deg, #0f172a 0%, #1e293b 45%, #0f766e 100%)",
          color: "#f8fafc",
        }}
      >
        {children}
      </body>
    </html>
  );
}
