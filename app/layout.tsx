import type { Metadata } from "next";
import "./globals.css";
import { PWARegister } from "@/components/pwa-register";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Stock & Billing",
  description: "Business stock and billing management",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>
        <Providers>
          <PWARegister />
          {children}
        </Providers>
      </body>
    </html>
  );
}
