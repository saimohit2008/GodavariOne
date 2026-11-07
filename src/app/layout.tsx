import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

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
      </body>
    </html>
  );
}
