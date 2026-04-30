import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InfraStreet",
  description: "Street food, one tap away",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] antialiased">
        {children}
      </body>
    </html>
  );
}
