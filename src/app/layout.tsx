import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finance",
  description: "Persoonlijk overzicht van uitgaven, terugvorderingen en retouren",
  manifest: "/manifest.json",
  // On a phone the app runs under the status bar (clock, battery): full screen, like a
  // banking app. A teal bar behind it (globals.css) keeps the clock readable.
  appleWebApp: { capable: true, title: "Finance", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#0f766e",
  viewportFit: "cover",
  // An app, not a page: no pinching in or out.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
