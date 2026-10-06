import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { OfflineProvider } from "@/components/offline-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const displaySerif = Fraunces({
  variable: "--font-display-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TouchGrass AI — AI that gets you outside",
    template: "%s · TouchGrass AI",
  },
  description:
    "TouchGrass AI generates short personalized outdoor missions using open-weight AI you can run yourself. Then it asks you to put your phone away.",
  applicationName: "TouchGrass AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TouchGrass AI",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "TouchGrass AI",
    description: "AI that gives you a reason to put your phone down.",
    type: "website",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f2" },
    { media: "(prefers-color-scheme: dark)", color: "#101a14" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} antialiased`}
      >
        <OfflineProvider>{children}</OfflineProvider>
      </body>
    </html>
  );
}
