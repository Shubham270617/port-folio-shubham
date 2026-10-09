import { Fredoka, JetBrains_Mono, Nunito_Sans } from "next/font/google";

// Display / headings / island labels
export const display = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
// Body copy
export const body = Nunito_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-body", display: "swap" });
// Tech tags, dates, small labels
export const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-mono", display: "swap" });
