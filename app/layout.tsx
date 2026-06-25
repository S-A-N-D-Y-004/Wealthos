import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { requireAuthenticatedSession } from "@/lib/auth-session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "WealthOS",
  description: "Enterprise-grade personal wealth operating system"
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAuthenticatedSession();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
