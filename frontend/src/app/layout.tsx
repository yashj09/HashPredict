import type { Metadata } from "next";
import { Geist, Geist_Mono, Chakra_Petch } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "HashPredict - Prediction Markets on HashKey Chain",
  description:
    "Trade on the outcome of real-world events. The first prediction market on HashKey Chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${chakraPetch.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-slate-200">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
