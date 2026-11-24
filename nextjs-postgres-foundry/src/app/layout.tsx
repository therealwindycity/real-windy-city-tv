import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Real Windy City — Council TV",
  description:
    "Every Cheyenne City Council meeting and ordinance, re-cut as a TV series: theme song, recap, cast, cliffhangers — and fifteen swipeable lenses on the same public record.",
};

export const viewport: Viewport = { themeColor: "#07090f" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#07090f] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
