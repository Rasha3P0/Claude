import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/config/brand";

const inter = Inter({ subsets: ["latin"] });

const pageTitle = BRAND.name
  ? `${BRAND.name} — ${BRAND.tagline}`
  : BRAND.tagline;

export const metadata: Metadata = {
  title: pageTitle,
  description: BRAND.description,
  openGraph: {
    title: pageTitle,
    description: BRAND.description,
    type: "website",
    siteName: BRAND.name ?? BRAND.tagline,
  },
  twitter: {
    card: "summary",
    title: pageTitle,
    description: BRAND.description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
