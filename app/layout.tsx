import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "City / Lab — Economy Simulator",
  description: "Explore how automation, layoffs, and household spending shape a city of one million people.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
