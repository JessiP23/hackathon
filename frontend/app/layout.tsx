import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import { InAppNotificationHost } from "@/app/components/InAppNotificationHost";
import { ReferralCapture } from "@/app/components/ReferralCapture";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "InfraStreet",
  description: "Street food, one tap away",
  appleWebApp: {
    capable: true,
    title: "InfraStreet",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} min-h-screen antialiased`}>
        <Suspense fallback={null}>
          <ReferralCapture />
        </Suspense>
        {children}
        <InAppNotificationHost />
      </body>
    </html>
  );
}
