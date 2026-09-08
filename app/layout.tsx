import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "./(app)/providers";

export const metadata: Metadata = { title: "Fan Retailer Survey" };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full"><Providers>{children}</Providers></body>
    </html>
  );
}
