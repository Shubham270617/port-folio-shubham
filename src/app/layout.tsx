import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { portfolio } from "@/data/portfolio";
import { body, display, mono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: `${portfolio.name} · ${portfolio.title}`,
  description: `${portfolio.name}, ${portfolio.title}. ${portfolio.intro}`,
  openGraph: {
    title: `${portfolio.name} · ${portfolio.title}`,
    description: portfolio.intro,
    type: "website"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFD3A5"
};

// Applies a saved night theme before first paint, so returning visitors never see a flash of day.
const themeBoot = "try{if(localStorage.getItem('theme')==='night')document.documentElement.dataset.theme='night'}catch(e){}";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
