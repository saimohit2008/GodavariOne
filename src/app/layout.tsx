import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { PwaInstallDialog } from "@/components/pwa/pwa-install-dialog";
import { PwaPromptBanner } from "@/components/pwa/pwa-prompt-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Godavari One — Godavari Pushkaralu 2027 Digital Platform",
  description:
    "Godavari One: a centralized digital platform for pilgrims, tourists, residents, and staff during Godavari Pushkaralu 2027 in Andhra Pradesh. Find ghats, restaurants, hotels, hospitals, transport, and tourist spots with verified locations and live crowd status.",
  keywords: [
    "Godavari Pushkaralu",
    "Godavari Pushkaralu 2027",
    "Godavari One",
    "Andhra Pradesh",
    "Rajahmundry",
    "Bhadrachalam",
    "ghats",
    "pilgrimage",
  ],
  authors: [{ name: "Godavari One" }],
  manifest: "/manifest.webmanifest",
  applicationName: "Godavari One",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Godavari One",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  verification: {
    google: "BNE7zhYF5Lxu0jzt-eLDDfTabAXWKj2-dtwkPJM_dlQ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
        <ServiceWorkerRegister />
        <PwaInstallDialog />
        <PwaPromptBanner />
      </body>
    </html>
  );
}
