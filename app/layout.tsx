import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GODSLEAD | AI Sales Intelligence",
  description:
    "Global AI-powered buyer intent discovery and sales intelligence platform by InfoDart Global.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
